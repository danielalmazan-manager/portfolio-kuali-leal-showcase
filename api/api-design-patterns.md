# API Design Patterns

## Architecture Philosophy

Kuali Leal leverages **Next.js Server Actions** instead of traditional REST APIs, providing:

- ✅ **Type-safe API calls** from client to server
- ✅ **Automatic serialization/deserialization**
- ✅ **No API route boilerplate** (no `/api` directory needed)
- ✅ **Progressive enhancement** (works without JavaScript)
- ✅ **Built-in security** (CSRF protection, no CORS issues)
- ✅ **Simplified error handling**

---

## Server Actions Pattern

### What are Server Actions?

Server Actions are asynchronous functions that run on the server but can be invoked directly from client components. They are marked with the `'use server'` directive.

**Traditional REST API**:
```typescript
// ❌ Old way: API route + fetch
// pages/api/appointments.ts
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const data = req.body;
  // ... business logic
  res.json({ success: true });
}

// Client code
const response = await fetch('/api/appointments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
const result = await response.json();
```

**Server Actions**:
```typescript
// ✅ New way: Server Action
// app/actions/appointments.ts
'use server';

export async function createAppointmentAction(formData: FormData) {
  const data = {
    serviceId: formData.get('serviceId'),
    date: formData.get('date'),
  };
  // ... business logic
  return { success: true };
}

// Client code (type-safe!)
import { createAppointmentAction } from '@/app/actions/appointments';

const result = await createAppointmentAction(formData);
```

---

## File Structure

```
src/app/actions/
├── auth.ts                 # Authentication (login, register, logout)
├── appointments.ts         # Booking management
├── business.ts             # Business profile CRUD
├── stripe-connect.ts       # Payment account setup
├── subscriptions.ts        # Subscription management
├── analytics.ts            # Dashboard metrics
├── email.ts               # Email verification & notifications
└── notifications.ts        # Push notification triggers
```

---

## Design Patterns & Conventions

### 1. Action Naming Convention

```typescript
// Pattern: <verb><Entity>Action
export async function createAppointmentAction() {}
export async function updateBusinessProfileAction() {}
export async function deleteServiceAction() {}
export async function fetchAnalyticsAction() {}
```

### 2. Return Type Pattern

**Always return a structured response**:
```typescript
type ActionResponse<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function exampleAction(): Promise<ActionResponse<User>> {
  try {
    const user = await prisma.user.findUnique(...);
    return { success: true, data: user };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to fetch user' };
  }
}
```

**Why?**: Consistent error handling on the client side:
```typescript
const result = await exampleAction();
if (!result.success) {
  toast.error(result.error);
  return;
}
// result.data is now safely typed
const user = result.data;
```

### 3. Form State Pattern (with useFormState)

For form submissions with progressive enhancement:

```typescript
// Server Action
export async function loginAction(
  prevState: any,
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'All fields are required' };
  }

  try {
    const user = await validateCredentials(email, password);
    await createSession(user);
  } catch (err) {
    return { error: 'Invalid credentials' };
  }

  redirect('/dashboard'); // Next.js redirect
}
```

```typescript
// Client Component
'use client';
import { useFormState } from 'react-dom';
import { loginAction } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, {});

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

**Benefits**:
- Works without JavaScript (progressive enhancement)
- Automatic loading states
- Form validation errors display automatically

### 4. Session Validation Pattern

**Every protected action must validate the session**:

```typescript
'use server';
import { getSession } from '@/lib/auth';

export async function protectedAction() {
  const session = await getSession();

  if (!session) {
    redirect('/login'); // Redirect unauthenticated users
  }

  // Proceed with authorized logic
  const userId = session.userId;
  // ...
}
```

### 5. Role-Based Authorization Pattern

```typescript
'use server';
import { getSession } from '@/lib/auth';

export async function businessOwnerOnlyAction() {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  if (session.role !== 'BUSINESS_OWNER' && session.role !== 'ADMIN') {
    throw new Error('Unauthorized: Business owner access required');
  }

  // Proceed with business owner logic
}
```

**Better approach with helper**:
```typescript
// lib/permissions.ts
export async function requireRole(
  allowedRoles: Array<'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN' | 'STAFF'>
) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (!allowedRoles.includes(session.role)) {
    throw new Error('Insufficient permissions');
  }

  return session;
}

// Usage in Server Action
export async function deleteBusinessAction(businessId: number) {
  const session = await requireRole(['BUSINESS_OWNER', 'ADMIN']);

  // Verify user owns the business
  const business = await prismaApp02.tableBusiness.findUnique({
    where: { idBusiness: businessId }
  });

  if (business.idUserOwner !== session.userId) {
    throw new Error('You do not own this business');
  }

  await prismaApp02.tableBusiness.delete({
    where: { idBusiness: businessId }
  });

  return { success: true };
}
```

### 6. Database Transaction Pattern

For operations spanning multiple tables:

```typescript
'use server';
import { prismaApp01 } from '@/lib/prisma';

export async function createAppointmentWithPaymentAction(data: AppointmentData) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  try {
    // Use Prisma transaction for atomicity
    const result = await prismaApp01.$transaction(async (tx) => {
      // Step 1: Create appointment
      const appointment = await tx.tableAppointments.create({
        data: {
          idAppointments: generateUUID(),
          idUser: session.userId,
          idBusiness: data.businessId,
          idService: data.serviceId,
          startTimeDate: data.datetime,
          bookingStatus: 'pending_payment',
          depositAmount: data.depositAmount,
        }
      });

      // Step 2: Create payment intent (Stripe API call)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.depositAmount * 100), // cents
        currency: 'mxn',
        metadata: {
          appointmentId: appointment.idAppointments,
          userId: session.userId,
        }
      });

      // Step 3: Update appointment with Stripe ID
      await tx.tableAppointments.update({
        where: { idAppointments: appointment.idAppointments },
        data: { stripeIntentId: paymentIntent.id }
      });

      return {
        appointment,
        clientSecret: paymentIntent.client_secret
      };
    });

    return { success: true, data: result };

  } catch (error) {
    console.error('Appointment creation failed:', error);
    return { success: false, error: 'Failed to create appointment' };
  }
}
```

### 7. Revalidation Pattern

Invalidate cached data after mutations:

```typescript
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updateServiceAction(serviceId: number, data: ServiceData) {
  await requireRole(['BUSINESS_OWNER', 'ADMIN']);

  await prismaApp02.tableServices.update({
    where: { idService: serviceId },
    data: data
  });

  // Revalidate specific paths that display this service
  revalidatePath('/dashboard/services');
  revalidatePath(`/services/${serviceId}`);

  // Or revalidate by tag (if using fetch with tags)
  revalidateTag('services');

  return { success: true };
}
```

---

## Real-World Examples

### Example 1: Authentication Flow

```typescript
// app/actions/auth.ts
'use server';

import { prismaApp01 } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';

export async function loginAction(
  prevState: any,
  formData: FormData
) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  // Validation
  if (!email || !password) {
    return { error: 'All fields are required' };
  }

  try {
    // Fetch user from Database 01
    const user = await prismaApp01.users.findFirst({
      where: { emailUser: email }
    });

    if (!user || !user.passwordHash) {
      return { error: 'Invalid credentials' };
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { error: 'Invalid credentials' };
    }

    // Create JWT session
    await createSession({
      userId: user.idUser,
      email: user.emailUser!,
      role: user.role as any,
    });

    // Role-based redirect
    if (user.role === 'CUSTOMER') {
      redirect('https://kualileal.com');
    }

  } catch (err) {
    console.error('[Login Error]:', err);
    return { error: 'Server error' };
  }

  redirect('/dashboard'); // Business owner/staff
}
```

### Example 2: Multi-Database Query

```typescript
// app/actions/appointments.ts
'use server';

import { prismaApp01 } from '@/lib/prisma';
import { prismaApp02 } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function fetchUserAppointmentsAction() {
  const session = await getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Fetch appointments from Database 01
  const appointments = await prismaApp01.tableAppointments.findMany({
    where: { idUser: session.userId },
    orderBy: { startTimeDate: 'desc' }
  });

  // Enrich with business data from Database 02
  const enrichedAppointments = await Promise.all(
    appointments.map(async (apt) => {
      const [business, service] = await Promise.all([
        prismaApp02.tableBusiness.findUnique({
          where: { idBusiness: apt.idBusiness! },
          select: { businessName: true, logoURL: true }
        }),
        prismaApp02.tableServices.findUnique({
          where: { idService: apt.idService! },
          select: { serviceName: true, costServiceFinal: true }
        })
      ]);

      return {
        ...apt,
        businessName: business?.businessName,
        businessLogo: business?.logoURL,
        serviceName: service?.serviceName,
        servicePrice: service?.costServiceFinal,
      };
    })
  );

  return { success: true, data: enrichedAppointments };
}
```

### Example 3: Stripe Integration

```typescript
// app/actions/stripe-connect.ts
'use server';

import { stripe } from '@/lib/stripe';
import { prismaApp02 } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function createStripeConnectAccountAction() {
  const session = await requireRole(['BUSINESS_OWNER']);

  try {
    // Fetch business owned by user
    const business = await prismaApp02.tableBusiness.findFirst({
      where: { idUserOwner: session.userId }
    });

    if (!business) {
      return { success: false, error: 'No business found' };
    }

    if (business.stripeAccountId) {
      return {
        success: false,
        error: 'Stripe account already exists'
      };
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'standard',
      email: session.email,
      business_type: 'individual', // or 'company'
      metadata: {
        businessId: business.idBusiness.toString(),
        userId: session.userId,
      }
    });

    // Save Stripe account ID
    await prismaApp02.tableBusiness.update({
      where: { idBusiness: business.idBusiness },
      data: { stripeAccountId: account.id }
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://app.kualileal.com/dashboard/stripe-refresh',
      return_url: 'https://app.kualileal.com/dashboard/stripe-complete',
      type: 'account_onboarding',
    });

    return {
      success: true,
      data: { onboardingUrl: accountLink.url }
    };

  } catch (error) {
    console.error('Stripe Connect creation failed:', error);
    return {
      success: false,
      error: 'Failed to create payment account'
    };
  }
}
```

---

## Input Validation with Zod

For complex data structures, use Zod schemas:

```typescript
'use server';
import { z } from 'zod';

const ServiceSchema = z.object({
  serviceName: z.string().min(3).max(100),
  descriptionService: z.string().max(500).optional(),
  costServiceOrigin: z.number().positive(),
  discountApplies: z.boolean(),
  porcentageDiscount: z.number().min(0).max(100).optional(),
  durationMinutes: z.number().positive(),
  depositPercentage: z.enum(['10', '30', '50', '100']),
});

type ServiceInput = z.infer<typeof ServiceSchema>;

export async function createServiceAction(
  rawData: unknown
): Promise<ActionResponse<{ serviceId: number }>> {
  const session = await requireRole(['BUSINESS_OWNER']);

  // Validate input
  const parseResult = ServiceSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0].message
    };
  }

  const data = parseResult.data;

  try {
    const business = await prismaApp02.tableBusiness.findFirst({
      where: { idUserOwner: session.userId }
    });

    if (!business) {
      return { success: false, error: 'No business found' };
    }

    const service = await prismaApp02.tableServices.create({
      data: {
        ...data,
        idBusiness: business.idBusiness,
        idStatusService: 1, // Active
      }
    });

    revalidatePath('/dashboard/services');

    return {
      success: true,
      data: { serviceId: service.idService }
    };

  } catch (error) {
    console.error('Service creation failed:', error);
    return { success: false, error: 'Failed to create service' };
  }
}
```

---

## Error Handling Best Practices

### Client-Side Error Display

```typescript
'use client';
import { useState } from 'react';
import { toast } from 'sonner'; // Toast library
import { createServiceAction } from '@/app/actions/business';

export function ServiceForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const result = await createServiceAction(data);

    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success('Service created successfully!');
    // Optionally redirect or reset form
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Service'}
      </button>
    </form>
  );
}
```

---

## Performance Considerations

### 1. Minimize Database Queries

**❌ Bad: N+1 Query Problem**
```typescript
const appointments = await prisma.tableAppointments.findMany();
for (const apt of appointments) {
  apt.service = await prisma.tableServices.findUnique({
    where: { idService: apt.idService }
  });
}
```

**✅ Good: Use Prisma includes or Promise.all**
```typescript
const appointments = await prisma.tableAppointments.findMany();
const serviceIds = appointments.map(apt => apt.idService);
const services = await prisma.tableServices.findMany({
  where: { idService: { in: serviceIds } }
});
const serviceMap = new Map(services.map(s => [s.idService, s]));
```

### 2. Use React Cache for Deduplication

```typescript
import { cache } from 'react';

export const getBusinessProfile = cache(async (businessId: number) => {
  return await prismaApp02.tableBusiness.findUnique({
    where: { idBusiness: businessId }
  });
});
```

**Benefit**: If called multiple times during a single request, only one DB query executes.

---

## Security Checklist

- ✅ **Session validation** on every protected action
- ✅ **Role-based authorization** before sensitive operations
- ✅ **Input validation** with Zod schemas
- ✅ **SQL injection prevention** via Prisma (parameterized queries)
- ✅ **Rate limiting** (implement at NGINX level for now)
- ✅ **CSRF protection** (built-in with Server Actions)
- ✅ **Sensitive data logging** (never log passwords, credit cards, etc.)

---

## Testing Server Actions

```typescript
// __tests__/actions/auth.test.ts
import { loginAction } from '@/app/actions/auth';

describe('loginAction', () => {
  it('should return error for invalid credentials', async () => {
    const formData = new FormData();
    formData.set('email', 'wrong@example.com');
    formData.set('password', 'wrongpassword');

    const result = await loginAction({}, formData);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('Invalid credentials');
  });

  it('should create session for valid credentials', async () => {
    // Mock database and bcrypt
    // ... test implementation
  });
});
```

---

## Comparison: Server Actions vs REST API

| Feature | Server Actions | REST API |
|---------|---------------|----------|
| **Type Safety** | ✅ Full (client ↔ server) | ❌ Requires codegen |
| **Boilerplate** | ✅ Minimal | ❌ High (route files) |
| **CORS** | ✅ No issues | ⚠️ Must configure |
| **CSRF Protection** | ✅ Built-in | ❌ Must implement |
| **Progressive Enhancement** | ✅ Works without JS | ❌ Requires JS |
| **Caching** | ✅ Automatic (Next.js) | ⚠️ Manual setup |
| **Error Handling** | ✅ Structured returns | ⚠️ HTTP status codes |
| **Revalidation** | ✅ Built-in (`revalidatePath`) | ❌ Manual cache invalidation |

---

**For detailed code examples, see the `/code-snippets` directory.**

*Last Updated: March 2026*
