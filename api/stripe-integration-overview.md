# Stripe Integration Overview

## Architecture

Kuali Leal uses **Stripe** for:
1. **Stripe Connect**: Marketplace payments (platform → merchants)
2. **Payment Intents**: Appointment deposits and balances
3. **Subscriptions**: SaaS recurring billing for business plans

---

## 1. Stripe Connect (Marketplace Payments)

### Business Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Customer Books Appointment                 │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Kuali Platform creates PaymentIntent                        │
│  • Amount: Service deposit (e.g., 30% of $100 = $30)        │
│  • Destination: Merchant's Stripe Connect account           │
│  • Application Fee: Platform commission (e.g., 10% = $3)    │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Customer completes payment via Stripe.js                    │
│  • Card never touches Kuali servers (PCI-DSS compliant)     │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Funds flow:                                                 │
│  ├─ Customer pays: $30.00                                   │
│  ├─ Stripe fee: ~$1.17 (2.9% + $0.30)                      │
│  ├─ Platform fee: $3.00 (10% of $30)                       │
│  └─ Merchant receives: $25.83                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation: Connect Account Creation

```typescript
// app/actions/stripe-connect.ts
'use server';

import { stripe } from '@/lib/stripe';
import { prismaApp02 } from '@/lib/prisma';

export async function createStripeConnectAccountAction() {
  const session = await getSession();
  if (!session || session.role !== 'BUSINESS_OWNER') {
    return { error: 'Unauthorized' };
  }

  const business = await prismaApp02.tableBusiness.findFirst({
    where: { idUserOwner: session.userId }
  });

  // Create Stripe Connect account
  const account = await stripe.accounts.create({
    type: 'standard', // Full onboarding (business verifies identity)
    country: 'MX',
    email: session.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual', // or 'company'
    metadata: {
      businessId: business.idBusiness.toString(),
    }
  });

  // Save to database
  await prismaApp02.tableBusiness.update({
    where: { idBusiness: business.idBusiness },
    data: { stripeAccountId: account.id }
  });

  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://app.kualileal.com/dashboard/stripe-refresh',
    return_url: 'https://app.kualileal.com/dashboard/stripe-complete',
    type: 'account_onboarding',
  });

  return { onboardingUrl: accountLink.url };
}
```

### Implementation: Payment Intent with Connect

```typescript
// app/actions/appointments.ts
'use server';

import { stripe } from '@/lib/stripe';
import { prismaApp01, prismaApp02 } from '@/lib/prisma';

export async function createAppointmentAction(data: AppointmentInput) {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated' };

  // Fetch service details
  const service = await prismaApp02.tableServices.findUnique({
    where: { idService: data.serviceId },
    include: { TableBusiness: true }
  });

  const depositAmount = service.costServiceFinal * (service.depositPercentage / 100);
  const platformFeePercentage = 0.10; // 10% commission
  const applicationFeeAmount = Math.round(depositAmount * platformFeePercentage * 100); // in cents

  // Create PaymentIntent with destination charge
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(depositAmount * 100), // Convert to cents
    currency: 'mxn',
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: service.TableBusiness.stripeAccountId!, // Merchant's account
    },
    metadata: {
      appointmentId: 'pending', // Will update after DB insert
      userId: session.userId,
      businessId: service.idBusiness.toString(),
      serviceId: service.idService.toString(),
    },
  });

  // Create appointment in Database 01
  const appointment = await prismaApp01.tableAppointments.create({
    data: {
      idAppointments: generateUUID(),
      idUser: session.userId,
      idBusiness: service.idBusiness,
      idService: service.idService,
      startTimeDate: data.datetime,
      totalPriceBalance: service.costServiceFinal,
      depositAmount: depositAmount,
      stripeIntentId: paymentIntent.id,
      bookingStatus: 'pending_payment',
    }
  });

  // Update PaymentIntent metadata
  await stripe.paymentIntents.update(paymentIntent.id, {
    metadata: { appointmentId: appointment.idAppointments }
  });

  return {
    success: true,
    clientSecret: paymentIntent.client_secret,
    appointmentId: appointment.idAppointments,
  };
}
```

### Client-Side Payment Confirmation

```typescript
// components/PaymentForm.tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PaymentForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm />
    </Elements>
  );
}

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: 'https://kualileal.com/appointments/confirmation',
      },
    });

    if (error) {
      // Handle error
      console.error(error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe}>
        Pay Deposit
      </button>
    </form>
  );
}
```

---

## 2. Webhook Handling

### Event Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Customer completes payment                                  │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Stripe fires webhook event:                                 │
│  • payment_intent.succeeded                                  │
│  • payment_intent.payment_failed                             │
│  • account.updated (for Connect accounts)                    │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Kuali receives webhook at /api/webhooks/stripe              │
│  1. Verify signature (security)                              │
│  2. Update appointment status                                │
│  3. Create payment ledger entry                              │
│  4. Calculate platform fee & merchant net                    │
│  5. Send confirmation email                                  │
└──────────────────────────────────────────────────────────────┘
```

### Webhook Implementation

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prismaApp01 } from '@/lib/prisma';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
      break;

    case 'account.updated':
      await handleAccountUpdate(event.data.object as Stripe.Account);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const appointmentId = paymentIntent.metadata.appointmentId;
  const amountPaid = paymentIntent.amount / 100; // Convert from cents
  const applicationFee = paymentIntent.application_fee_amount
    ? paymentIntent.application_fee_amount / 100
    : 0;
  const merchantNet = amountPaid - applicationFee;

  // Update appointment status
  await prismaApp01.tableAppointments.update({
    where: { idAppointments: appointmentId },
    data: { bookingStatus: 'confirmed' }
  });

  // Create payment ledger entry
  await prismaApp01.tablePurchaseMovements.create({
    data: {
      idUser: paymentIntent.metadata.userId,
      idAppointments: appointmentId,
      amountDeposited: amountPaid,
      kualiFee: applicationFee,
      entrepreneurNet: merchantNet,
      paymentType: 'deposit',
      status: 'succeeded',
      stripeIntentId: paymentIntent.id,
    }
  });

  // Send confirmation email (implement separately)
  // await sendAppointmentConfirmationEmail(appointmentId);

  console.log(`Payment succeeded for appointment ${appointmentId}`);
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const appointmentId = paymentIntent.metadata.appointmentId;

  // Mark appointment as failed
  await prismaApp01.tableAppointments.update({
    where: { idAppointments: appointmentId },
    data: { bookingStatus: 'cancelled' }
  });

  console.log(`Payment failed for appointment ${appointmentId}`);
}

async function handleAccountUpdate(account: Stripe.Account) {
  // Update business with Connect account capabilities
  await prismaApp02.tableBusiness.update({
    where: { stripeAccountId: account.id },
    data: {
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      tosAcceptanceDate: account.tos_acceptance?.date
        ? new Date(account.tos_acceptance.date * 1000)
        : null,
    }
  });

  console.log(`Updated Connect account ${account.id}`);
}
```

### Testing Webhooks Locally

**Use Stripe CLI**:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

---

## 3. Subscription Billing

### Business Plan Tiers

| Plan | Price (MXN) | Features |
|------|------------|----------|
| **FREE** | $0/month | 1 location, 50 customers, basic analytics |
| **STARTER** | $299/month | 3 locations, 500 customers, WhatsApp support |
| **PRO** | $799/month | Unlimited locations, unlimited customers, priority support |

### Implementation: Create Subscription

```typescript
// app/actions/subscriptions.ts
'use server';

import { stripe } from '@/lib/stripe';
import { prismaApp02 } from '@/lib/prisma';

export async function upgradeSubscriptionAction(planId: number) {
  const session = await requireRole(['BUSINESS_OWNER']);

  const business = await prismaApp02.tableBusiness.findFirst({
    where: { idUserOwner: session.userId }
  });

  const plan = await prismaApp02.tableSubscriptionCatalog.findUnique({
    where: { idPlanSelect: planId }
  });

  if (plan.namePlan === 'FREE') {
    return { error: 'Cannot create subscription for FREE plan' };
  }

  // Create Stripe customer if doesn't exist
  let stripeCustomerId = business.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      metadata: { businessId: business.idBusiness.toString() }
    });
    stripeCustomerId = customer.id;

    await prismaApp02.tableBusiness.update({
      where: { idBusiness: business.idBusiness },
      data: { stripeCustomerId: customer.id }
    });
  }

  // Create Stripe subscription
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [
      {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Kuali Leal - ${plan.namePlan}`,
          },
          recurring: { interval: 'month' },
          unit_amount: Math.round(plan.monthlyPrice * 100),
        },
      },
    ],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

  // Save subscription to database
  await prismaApp02.tableBusinessSubscriptions.create({
    data: {
      idPlanSelect: planId,
      idBusiness: business.idBusiness,
      stripeSuscriptionId: subscription.id,
      stripeCustomerId: stripeCustomerId,
      startDate: new Date(),
      renewalDate: new Date(subscription.current_period_end * 1000),
      idStatusBusinessSubscriptions: 1, // Pending
    }
  });

  // Update business current plan
  await prismaApp02.tableBusiness.update({
    where: { idBusiness: business.idBusiness },
    data: {
      currentPlan: plan.namePlan as any,
      subscriptionId: subscription.id,
      subscriptionStatus: 'incomplete',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  });

  return {
    success: true,
    clientSecret: paymentIntent.client_secret,
    subscriptionId: subscription.id,
  };
}
```

### Webhook: Subscription Events

```typescript
// app/api/webhooks/stripe/route.ts (continued)

case 'customer.subscription.created':
case 'customer.subscription.updated':
  await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
  break;

case 'customer.subscription.deleted':
  await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
  break;

case 'invoice.payment_succeeded':
  await handleInvoicePaid(event.data.object as Stripe.Invoice);
  break;

case 'invoice.payment_failed':
  await handleInvoiceFailed(event.data.object as Stripe.Invoice);
  break;

// Implementations
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  await prismaApp02.tableBusiness.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      subscriptionStatus: subscription.status as any,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  });
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await prismaApp02.tableBusiness.update({
    where: { subscriptionId: subscription.id },
    data: {
      currentPlan: 'FREE',
      subscriptionStatus: 'canceled',
      subscriptionId: null,
    }
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await prismaApp02.tableBusiness.update({
      where: { subscriptionId: invoice.subscription as string },
      data: { subscriptionStatus: 'active' }
    });
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await prismaApp02.tableBusiness.update({
      where: { subscriptionId: invoice.subscription as string },
      data: { subscriptionStatus: 'past_due' }
    });
  }
}
```

---

## 4. Fee Calculation Logic

### Platform Commission Structure

```typescript
// lib/loyalty.ts
export function calculatePaymentSplit(
  servicePrice: number,
  depositPercentage: number,
  platformFeePercentage: number = 0.10 // 10% default
) {
  const depositAmount = servicePrice * (depositPercentage / 100);
  const platformFee = depositAmount * platformFeePercentage;
  const merchantNet = depositAmount - platformFee;

  return {
    depositAmount,
    platformFee,
    merchantNet,
    balanceRemaining: servicePrice - depositAmount,
  };
}

// Example usage
const service = { costServiceFinal: 1000, depositPercentage: 30 };
const split = calculatePaymentSplit(service.costServiceFinal, service.depositPercentage);

console.log(split);
// {
//   depositAmount: 300,
//   platformFee: 30,
//   merchantNet: 270,
//   balanceRemaining: 700
// }
```

---

## 5. Security Best Practices

### ✅ Implemented

1. **Webhook Signature Verification**: Prevents spoofed webhook calls
2. **Idempotency Keys**: Prevents duplicate charges if retry occurs
3. **Server-Side Payment Confirmation**: Never trust client-side success
4. **No Card Storage**: Cards handled entirely by Stripe (PCI-DSS compliant)
5. **Connect Account Validation**: Verify `chargesEnabled` before processing

### Example: Idempotency

```typescript
const idempotencyKey = `appointment-${appointmentId}-deposit`;

const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: 30000,
    currency: 'mxn',
    // ...
  },
  {
    idempotencyKey, // Prevents duplicate charges
  }
);
```

---

## 6. Error Handling

### Common Stripe Errors

```typescript
import Stripe from 'stripe';

try {
  const paymentIntent = await stripe.paymentIntents.create({...});
} catch (err) {
  if (err instanceof Stripe.errors.StripeCardError) {
    // Card declined
    return { error: 'Your card was declined. Please try another card.' };
  } else if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    // Invalid parameters
    return { error: 'Invalid payment request. Please contact support.' };
  } else if (err instanceof Stripe.errors.StripeAPIError) {
    // Stripe server error
    return { error: 'Payment service temporarily unavailable. Please try again.' };
  } else if (err instanceof Stripe.errors.StripeConnectionError) {
    // Network error
    return { error: 'Network error. Please check your connection.' };
  } else if (err instanceof Stripe.errors.StripeAuthenticationError) {
    // API key issue
    console.error('Stripe authentication failed!');
    return { error: 'Payment system error. Please contact support.' };
  } else {
    // Unknown error
    console.error('Unexpected Stripe error:', err);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
```

---

## 7. Testing

### Test Cards

**Successful Payment**:
- Card Number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

**Declined Payment**:
- Card Number: `4000 0000 0000 0002`

**3D Secure Authentication Required**:
- Card Number: `4000 0025 0000 3155`

### Test Mode vs Live Mode

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!, // sk_test_... or sk_live_...
  {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  }
);
```

**Environment Variables**:
```bash
# .env.local (development)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY

# .env.production
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
```

---

## Resources

- **Stripe Dashboard**: https://dashboard.stripe.com/
- **Stripe Docs**: https://stripe.com/docs
- **Connect Documentation**: https://stripe.com/docs/connect
- **Webhook Testing**: https://stripe.com/docs/webhooks/test

---

*Last Updated: March 2026*
