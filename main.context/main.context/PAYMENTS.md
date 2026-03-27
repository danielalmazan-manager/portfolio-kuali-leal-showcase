# Módulo de Pagos — Stripe

## Dos usos de Stripe en el proyecto

### 1. Subscriptions (B2B: Kuali Leal cobra al negocio)
El negocio paga un plan mensual para usar la plataforma.
- FREE: sin pago
- STARTER: pago mensual recurrente
- PRO: pago mensual recurrente más alto

### 2. Connect (B2C: El negocio cobra a sus clientes)
Kuali Leal actúa como plataforma de pagos; los negocios reciben pagos de sus clientes por servicios/citas.

## Stripe Subscriptions — Flujo completo

### Configuración
- **Archivo:** `src/lib/stripe.ts` en app.kualileal.com
- **Exports:** `stripe` (instancia), `publishableKey`, `webhookSecret`, `STRIPE_PRICES`, `getPriceIdForPlan()`

```typescript
const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PRO: process.env.STRIPE_PRICE_PRO,
};
```

### Crear suscripción (onboarding paso 6-7)

**Action:** `createSubscriptionAction` en `actions/business-registration.ts`

```
1. getSession() → obtener userId
2. prismaApp01.users.findUnique({ where: { id: userId } })
3. Si user.stripeCustomerId existe → recuperar Customer
   Si no → stripe.customers.create({ email, name, metadata: { userId } })
   → guardar stripeCustomerId en Users (App01)
4. stripe.subscriptions.create({
     customer: stripeCustomerId,
     items: [{ price: STRIPE_PRICES[plan] }],
     payment_behavior: 'default_incomplete',
     payment_settings: { payment_method_types: ['card'] },
     expand: ['latest_invoice.payment_intent'],
   })
5. Guardar subscriptionId en TableBusiness (App02)
6. Retornar clientSecret del payment_intent al frontend
```

### Pago en frontend (onboarding paso 7)

**Página:** `/register/business/payment`
- Usa `@stripe/react-stripe-js` con `Elements` provider
- `PaymentElement` renderiza el formulario de tarjeta
- Al confirmar → `stripe.confirmPayment({ clientSecret })`
- Stripe procesa el pago → envía webhook

### Webhook de confirmación

**Endpoint:** `POST /api/webhooks/stripe/route.ts`

```typescript
// 1. Validar firma HMAC
const sig = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

// 2. Procesar según tipo de evento
switch (event.type) {
  case 'payment_intent.succeeded':
    // Buscar negocio por stripeCustomerId
    // Actualizar TableBusiness.subscriptionStatus = 'active'
    break;

  case 'customer.subscription.updated':
    // Actualizar plan y estado de suscripción
    break;

  case 'account.updated':
    // Actualizar estado de Stripe Connect Account
    break;
}
```

### Cambio de plan desde dashboard

**Página:** `/dashboard/plans`
**Componente:** `PlanComparison.tsx`

Permite upgrade/downgrade. Utiliza la API de Stripe para modificar la suscripción existente.

## Stripe Connect — Flujo

### Crear cuenta de Connect

**Action:** `createSubscriptionAction` en `actions/business-registration.ts`

La cuenta de Stripe Connect (para que el negocio *reciba* pagos de sus clientes) se crea mediante `StripeConnectButton.tsx` + `actions/stripe-connect.ts`.

```
1. stripe.accounts.create({
     type: 'custom',
     country: 'MX',
     capabilities: { transfers: { requested: true } },
     metadata: { businessId },
   })
   → guardar stripeAccountId en TableBusiness (App02)
```

> **Nota:** `actions/business.ts` fue eliminado en la limpieza de 2026-03-26. Las funciones que incluía (`activateBusinessAction`, `saveBusinessInfoAction`, `saveLocationAction`) eran legacy y solo usadas por el flujo de onboarding eliminado.

### Completar KYC

**Componente:** `StripeConnectButton.tsx` en `/dashboard/`
**Action:** `actions/stripe-connect.ts`

```
1. stripe.accountLinks.create({
     account: stripeAccountId,
     refresh_url: 'app.kualileal.com/dashboard',
     return_url: 'app.kualileal.com/dashboard',
     type: 'account_onboarding',
   })
2. Redirige al usuario a Stripe Dashboard para completar KYC
3. Al regresar → webhook account.updated confirma el estado
```

## Payment Intent (kualileal.com)

**Endpoint:** `POST /api/payments/create-intent` en kualileal.com

Crea un Payment Intent para pagos individuales (cuando un cliente paga por un servicio/cita). Este es diferente a la suscripción del plan.

## Variables de entorno

```
STRIPE_SECRET_KEY          # API key del servidor
STRIPE_PUBLISHABLE_KEY     # API key del cliente (pk_*)
STRIPE_WEBHOOK_SECRET      # Para validar firmas HMAC de webhooks
STRIPE_PRICE_STARTER       # Price ID del plan STARTER en Stripe
STRIPE_PRICE_PRO           # Price ID del plan PRO en Stripe
```

## Campos de BD relacionados con Stripe

### Users (App01)
- `stripeCustomerId` — **SOURCE OF TRUTH** para el Customer de Stripe que se le *cobra* la suscripción de plataforma (Kuali Leal cobra al negocio). Es el Customer ID usado en `createSubscriptionAction` y en el webhook handler para encontrar al usuario via `findFirst({ where: { stripeCustomerId: customerId } })`.

### TableBusiness (App02)
- `stripeCustomerId` — **DEPRECADO**. Fue poblado por el flujo legacy (`activateBusinessAction` en `actions/business.ts`, eliminado 2026-03-26). Pueden quedar registros históricos del Customer ID en este campo. El flujo activo YA NO escribe aquí. **No eliminar el campo** hasta verificar que no haya código activo que lo lea.
- `stripeAccountId` — Stripe Connect Account ID del negocio (para *recibir* pagos de sus clientes)
- `subscriptionId` — Stripe Subscription ID
- `subscriptionStatus` — active | past_due | canceled | incomplete
- `currentPlan` — FREE | STARTER | PRO

> **Resumen:** El mismo Customer de Stripe puede estar guardado en ambas tablas si el negocio fue creado antes de 2026-03-26. El campo autoritativo es `Users.stripeCustomerId`. El webhook handler usa este campo correctamente.

## Puntos de fallo

1. **Customer duplicado:** `createSubscriptionAction` verifica si `Users.stripeCustomerId` ya existe antes de crear uno nuevo. Busca también por email en Stripe Dashboard. ✅

2. **Subscription incompleta huérfana:** Si el usuario abandona el paso de pago, queda una Subscription incompleta en Stripe. No hay cleanup automático.

3. ~~**stripeCustomerId en dos tablas:**~~ ✅ **RESUELTO** (2026-03-26) — Ver sección "Campos de BD" arriba para la documentación completa.

4. ~~**Webhooks sin idempotencia:**~~ ✅ **RESUELTO** (2026-03-26) — Se agregaron verificaciones de estado previo en todos los handlers. Ver `src/app/api/webhooks/stripe/route.ts`.

5. ~~**Falta manejo de `invoice.payment_failed`:**~~ ✅ **RESUELTO** — El handler ya actualiza `subscriptionStatus = 'past_due'` cuando hay un pago fallido.
