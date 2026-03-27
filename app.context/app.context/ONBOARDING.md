# Módulo de Onboarding de Negocio

## Flujo activo: 8 pasos en app.kualileal.com

**Ubicación:** `app.kualileal.com/src/app/(auth)/register/business/`
**Server Action principal:** `src/app/actions/business-registration.ts` (504 líneas)

### Cómo se llega aquí
1. Usuario se registra en kualileal.com → rol CUSTOMER
2. En `/role-selection` elige "Tengo un Negocio"
3. `updateRoleAction` cambia rol a BUSINESS_OWNER y redirige a `app.kualileal.com/register/business/whatsapp`

**NOTA:** El usuario tiene rol BUSINESS_OWNER pero aún NO tiene negocio creado. El middleware de app.kualileal.com permite acceso a `/register/business/*` para este caso.

### Paso 1: WhatsApp (`/register/business/whatsapp`)
- Input: número de WhatsApp del negocio
- Action: `sendWhatsappCodeAction`
  - Formatea número mexicano (+521...)
  - Genera OTP de 6 dígitos
  - Guarda en `users.verificationCode` y establece `verificationCodeExpiry` (+10 min) (App01)
  - Envía por WhatsApp Cloud API (Meta)
- Redirect → `/register/business/verify-whatsapp`

### Paso 2: Verificar WhatsApp (`/register/business/verify-whatsapp`)
- Input: código OTP de 6 dígitos
- Action: `verifyWhatsappCodeAction`
  - Compara contra `users.verificationCode`
  - Valida que `verificationCodeExpiry` sea mayor a la fecha actual (Fase 1.3)
  - Si coincide y es válido: limpia `verificationCode`, actualiza `phoneNumber`
- Redirect → `/register/business/info`

### Paso 3: Info del negocio (`/register/business/info`)
- Inputs: nombre, descripción, categoría, tipo de negocio, logo (upload), redes sociales
- Action: `saveBusinessInfoAction`
  - Crea `TableBusiness` en App02 con `userId` de la sesión
  - Crea relación N:N en `TableNNBusinessType`
  - `updateSession({ businessId })` ← agrega businessId al JWT
- Redirect → `/register/business/tax`

### Paso 4: Datos fiscales (`/register/business/tax`)
- Inputs: RFC, régimen fiscal (select), dirección fiscal, documento fiscal (upload PDF/imagen)
- Action: `saveBusinessTaxAction`
  - Crea/actualiza `TableTaxData` vinculada al negocio
- Redirect → `/register/business/locations`
- Opción "Guardar para después" → redirect a `/dashboard`

### Paso 5: Ubicaciones (`/register/business/locations`)
- Inputs: dirección, CP, ciudad, estado, teléfono local, horarios por día (lunes-domingo), días festivos
- Action: `saveBusinessLocationAction`
  - Crea `TableCommercialLocations`
  - Crea 7 registros en `TableOperatingHours` (uno por día)
  - Crea registros en `TableDaysOff` si se especificaron
- Redirect → `/register/business/pricing`

### Paso 6: Selección de plan (`/register/business/pricing`)
- Muestra comparativa de planes: FREE, STARTER, PRO
- Si elige FREE:
  - Action: `saveFreePlanAction`
  - Actualiza `TableBusiness.currentPlan = 'FREE'`
  - Redirect → `/register/business/payment-success`
- Si elige STARTER o PRO:
  - Action: `createSubscriptionAction`
  - Crea/recupera Stripe Customer (guarda stripeCustomerId en Users y TableBusiness)
  - Crea Stripe Subscription con `payment_behavior: 'default_incomplete'`
  - Retorna `clientSecret` para Stripe Elements
  - Redirect → `/register/business/payment`

### Paso 7: Pago (`/register/business/payment`) — solo STARTER/PRO
- Renderiza Stripe Elements con el `clientSecret`
- El usuario completa el pago en el formulario embebido
- Stripe procesa → envía webhook a `/api/webhooks/stripe`
- Webhook handler:
  - `payment_intent.succeeded` → actualiza `TableBusiness.subscriptionStatus = 'active'`
- Redirect → `/register/business/payment-success`

### Paso 8: Confirmación (`/register/business/payment-success`)
- Muestra mensaje de éxito
- Botón "Ir al Dashboard" → `/dashboard`

## Flujos legacy — ELIMINADOS (2026-03-24)

Los siguientes flujos fueron eliminados en la limpieza del 2026-03-24:
- ✅ `kualileal.com/(onboarding)/` — eliminado
- ✅ `app.kualileal.com/(onboarding)/` — eliminado
- ✅ `app.kualileal.com/onboarding/page.tsx` — eliminado
- ✅ `app.kualileal.com/actions/onboarding.ts` — eliminado

El único flujo activo es el de 8 pasos en `app.kualileal.com/(auth)/register/business/`.

## Puntos de fallo conocidos

1. **Stripe Customer duplicado:** `createSubscriptionAction` ahora busca clientes existentes por email antes de crear nuevos. ✅

2. **Sesión desincronizada:** El uso de `apiClient` con auto-redirect ayuda a mitigar fallos de sesión.

3. **Upload en pasos 3 y 4:** Mejorado con validación de magic bytes y sanitización de nombres. ✅

4. ✅ **WhatsApp OTP timeout:** **RESUELTO** con `verificationCodeExpiry` y validación en `verifyWhatsappCodeAction`.

5. **Navegación hacia atrás:** Si el usuario navega hacia atrás después del paso 3 (donde se creó el negocio), y vuelve a enviar el formulario del paso 3, podría crear un negocio duplicado si `saveBusinessInfoAction` usa `create` en vez de `upsert`.
