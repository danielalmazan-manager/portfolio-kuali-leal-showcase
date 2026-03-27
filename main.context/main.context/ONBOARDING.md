# Módulo de Onboarding de Negocio

## Sistema de Onboarding Progresivo (2026-03-27) ✅

**Estado:** Implementado con SSO ligero y pasos opcionales
**Documentación completa:** `/var/www/ONBOARDING_IMPLEMENTATION_GUIDE.md`

### Arquitectura de 2 dominios

```
kualileal.com (Dominio Principal)
  │
  ├─ /role-selection (Paso 1: Zona B)
  │   └─ Usuario elige "Tengo un Negocio"
  │       └─ updateRoleAction: CUSTOMER → BUSINESS_OWNER
  │
  └─ Cookie SSO: domain=".kualileal.com" (compartida)
      │
      ▼
app.kualileal.com (Subdominio SaaS)
  │
  └─ /register/business/
      ├─ whatsapp (Paso 2: REQUERIDO)
      ├─ verify-whatsapp (Paso 3: REQUERIDO)
      ├─ info (Paso 4: REQUERIDO) → sets has_basic_business_info = TRUE
      ├─ tax (Paso 5: OPCIONAL) → sets has_tax_info = TRUE
      ├─ locations (Paso 6: OPCIONAL) → sets has_locations = TRUE
      └─ pricing (Paso 7: REQUERIDO) → sets has_business_module_active = TRUE
```

### Base de Datos: Campos de Onboarding Progresivo

**Tabla:** `bdKualiLealApp01.users`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `business_registration_step` | VARCHAR(255) | NULL | URL del último paso completado |
| `has_basic_business_info` | BOOLEAN | FALSE | TRUE cuando completa Paso 4 (info + logo) |
| `has_business_module_active` | BOOLEAN | FALSE | TRUE cuando completa Paso 7 o hace skip |
| `has_tax_info` | BOOLEAN | FALSE | TRUE cuando completa Paso 5 (datos fiscales) |
| `has_locations` | BOOLEAN | FALSE | TRUE cuando completa Paso 6 (ubicaciones) |
| `onboarding_completed_at` | TIMESTAMP | NULL | Fecha de completado |
| `last_onboarding_update` | TIMESTAMP | CURRENT_TIMESTAMP | Última modificación |

**Índices:**
- `idx_has_business_module_active`
- `idx_business_registration_step`

### Reglas de Acceso al Dashboard

```typescript
// Middleware: app.kualileal.com/src/middleware.ts
if (pathname.startsWith('/dashboard')) {
  if (!session.has_business_module_active) {
    // Redirigir a siguiente paso del onboarding
    const nextStep = getNextOnboardingStep(session);
    redirect(nextStep);
  }
  // Permitir acceso
}
```

### Pasos Opcionales con "Saltar por el Momento"

**Paso 5 (Tax) y Paso 6 (Locations):**
- Usuario puede hacer clic en "Saltar por el momento"
- `skipStep('tax')` → Marca paso como visitado pero NO completo
- Usuario avanza al siguiente paso
- Dashboard muestra banner persuasivo para completar después

**Gated Features:**
- ❌ Stripe activation bloqueado si `has_tax_info = FALSE`
- ⚠️ Banner recordatorio en todas las páginas del dashboard

---

## Flujo Detallado: 7 Pasos Exactos

### Paso 1: Role Selection (kualileal.com)
**Ruta:** `https://kualileal.com/role-selection`
**Acción:** `updateRoleAction`
- Cambia `users.role` de CUSTOMER → BUSINESS_OWNER
- Actualiza `business_registration_step` = 'https://kualileal.com/role-selection'
- Redirect → `https://app.kualileal.com/register/business/whatsapp`

---

### Paso 2: WhatsApp (app.kualileal.com)
**Ruta:** `https://app.kualileal.com/register/business/whatsapp`
**Acción:** `sendWhatsappCodeAction`
- Input: Número de WhatsApp del negocio
- Formatea número mexicano (+521...)
- Genera OTP de 6 dígitos
- Guarda en `users.verificationCode` con `verificationCodeExpiry` (+10 min)
- Envía por WhatsApp Cloud API (Meta)
- Actualiza `business_registration_step`
- Redirect → `/register/business/verify-whatsapp`

---

### Paso 3: Verificar WhatsApp
**Ruta:** `https://app.kualileal.com/register/business/verify-whatsapp`
**Acción:** `verifyWhatsappCodeAction`
- Input: Código OTP de 6 dígitos
- Compara contra `users.verificationCode`
- Valida `verificationCodeExpiry > NOW()`
- Si válido: limpia código, actualiza `phoneNumber`
- Actualiza `business_registration_step`
- Redirect → `/register/business/info`

---

### Paso 4: Información del Negocio (REQUERIDO)
**Ruta:** `https://app.kualileal.com/register/business/info`
**Acción:** `saveBusinessInfoAction`
**Inputs:**
- Nombre del negocio
- Descripción
- Categoría
- Tipo de negocio
- Logo (upload a S3)
- Redes sociales

**DB Operations:**
- Crea `TableBusiness` en App02
- Crea relación en `TableNNBusinessType`
- **Actualiza `has_basic_business_info = TRUE`**
- Actualiza `business_registration_step`
- `updateSession({ businessId, has_basic_business_info: true })`

**Redirect:** `/register/business/tax`

---

### Paso 5: Datos Fiscales (OPCIONAL) ⭐
**Ruta:** `https://app.kualileal.com/register/business/tax`
**Acción:** `saveBusinessTaxAction` o `skipStep('tax')`
**Inputs:**
- RFC (requerido si completa)
- Régimen fiscal
- Razón social
- Dirección fiscal
- Email de facturación
- Constancia fiscal (PDF upload)

**Opciones:**
1. **Guardar y Continuar:**
   - Crea/actualiza `TableTaxData`
   - **Actualiza `has_tax_info = TRUE`**
   - Actualiza `business_registration_step`
   - Redirect → `/register/business/locations`

2. **Saltar por el momento:**
   - Llama `skipStep('tax')`
   - Actualiza solo `business_registration_step`
   - `has_tax_info` permanece FALSE
   - Redirect → `/register/business/locations`

**Gated Feature:**
- Activación de Stripe BLOQUEADA si `has_tax_info = FALSE`

---

### Paso 6: Ubicaciones (OPCIONAL) ⭐
**Ruta:** `https://app.kualileal.com/register/business/locations`
**Acción:** `saveBusinessLocationAction` o `skipStep('locations')`
**Inputs:**
- Dirección completa
- Código postal
- Ciudad, Estado
- Teléfono local
- Horarios de operación (lunes-domingo)
- Días festivos

**Opciones:**
1. **Guardar y Continuar:**
   - Crea `TableCommercialLocations`
   - Crea 7 registros en `TableOperatingHours`
   - **Actualiza `has_locations = TRUE`**
   - Actualiza `business_registration_step`
   - Redirect → `/register/business/pricing`

2. **Saltar por el momento:**
   - Llama `skipStep('locations')`
   - `has_locations` permanece FALSE
   - Redirect → `/register/business/pricing`

---

### Paso 7: Selección de Plan (REQUERIDO)
**Ruta:** `https://app.kualileal.com/register/business/pricing`
**Planes:** FREE, STARTER ($299/mes), PRO ($599/mes)

**Opción A: Plan FREE**
- Acción: `saveFreePlanAction`
- Actualiza `TableBusiness.currentPlan = 'FREE'`
- **Actualiza `has_business_module_active = TRUE`**
- **Actualiza `onboarding_completed_at = NOW()`**
- Redirect → `/dashboard/inicio`

**Opción B: STARTER/PRO (con Stripe)**
- Acción: `createSubscriptionAction`
- Crea/recupera Stripe Customer
- Crea Stripe Subscription
- Retorna `clientSecret`
- Redirect → `/register/business/payment`
- Tras pago exitoso:
  - Webhook actualiza `subscriptionStatus = 'active'`
  - **Actualiza `has_business_module_active = TRUE`**
  - **Actualiza `onboarding_completed_at = NOW()`**
  - Redirect → `/dashboard/inicio`

---

## Server Actions de Onboarding

**Archivo:** `app.kualileal.com/src/app/actions/onboarding.ts`

```typescript
// Marcar paso como completado
await markStepComplete('tax');
// Auto-redirige al siguiente paso

// Saltar paso opcional
await skipStep('tax');
// Auto-redirige al siguiente paso

// Obtener progreso actual
const progress = await getOnboardingProgress();
// { has_basic_business_info, has_business_module_active, ... }

// Acción del botón "Mi Negocio"
await goToMyBusiness();
// Redirige inteligentemente según estado
```

---

## Componentes UI

### OnboardingBanner (Dashboard)
**Archivo:** `app.kualileal.com/src/components/dashboard/OnboardingBanner.tsx`

```typescript
<OnboardingBanner
  missingTax={!state.has_tax_info}
  missingLocations={!state.has_locations}
/>
```

Muestra banner persuasivo con links a pasos pendientes.

### GatedFeatureNotice
```typescript
<GatedFeatureNotice feature="payments" />
```

Bloquea visualización de features que requieren datos faltantes.

### OnboardingLayout
```typescript
<OnboardingLayout currentStep="tax" title="Datos Fiscales">
  {/* Contenido */}
</OnboardingLayout>
```

Wrapper con barra de progreso visual.

---

## Middleware Inteligente

**Archivo:** `app.kualileal.com/src/middleware.ts`

**Protección del Dashboard:**
```typescript
if (pathname.startsWith('/dashboard')) {
  if (!session.has_business_module_active) {
    const nextStep = getNextOnboardingStep(session);
    redirect(nextStep); // URL absoluta
  }
}
```

**Protección de Onboarding:**
```typescript
if (pathname.startsWith('/register/business')) {
  if (session.has_business_module_active) {
    // Ya completó onboarding
    redirect('/dashboard/inicio');
  }
}
```

---

## Session Sharing (SSO Ligero)

**Configuración de Cookies:**

```typescript
// kualileal.com/src/lib/auth.ts
// app.kualileal.com/src/lib/auth.ts
export async function createSession(payload: SessionPayload) {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };

  if (process.env.NODE_ENV === "production") {
    cookieOpts.domain = ".kualileal.com"; // ⭐ Con punto inicial
  }

  cookieStore.set(COOKIE_NAME, session, cookieOpts);
}
```

**SessionPayload Extendido:**
```typescript
export interface SessionPayload {
  userId: string;
  email: string;
  role: "CUSTOMER" | "BUSINESS_OWNER" | "ADMIN" | "STAFF";
  businessId?: string;
  // Campos de onboarding progresivo
  business_registration_step?: string | null;
  has_basic_business_info?: boolean;
  has_business_module_active?: boolean;
  has_tax_info?: boolean;
  has_locations?: boolean;
}
```

---

## Tipos y Helpers

**Archivo:** `app.kualileal.com/src/types/onboarding.ts`

```typescript
// Rutas EXACTAS del onboarding
export const ONBOARDING_ROUTES: Record<OnboardingStep, OnboardingRoute>;

// Obtener siguiente paso
export function getNextOnboardingStep(state: Partial<OnboardingState>): string | null;

// Verificar acceso al dashboard
export function canAccessDashboard(state: Partial<OnboardingState>): boolean;

// Verificar pasos incompletos
export function getIncompleteOptionalSteps(state): { tax: boolean; locations: boolean };
```

---

## Reglas Críticas para la IA

1. **URLs Absolutas para Cross-Domain:**
   ```typescript
   // ❌ INCORRECTO
   redirect('/dashboard/inicio');

   // ✅ CORRECTO
   redirect('https://app.kualileal.com/dashboard/inicio');
   ```

2. **Rutas Exactas (NO Genéricas):**
   - ✅ `/register/business/tax`
   - ❌ `/onboarding`
   - ❌ `/onboarding/step5`

3. **Actualizar Sesión tras DB:**
   ```typescript
   await updateOnboardingState({ userId, has_tax_info: true });
   await updateSession({ has_tax_info: true }); // ⭐ Crítico
   ```

4. **Verificar Estado antes de Renderizar:**
   ```typescript
   const session = await getSession();
   if (!session.has_business_module_active) {
     redirect(getNextOnboardingStep(session));
   }
   ```

---

## Flujos legacy — ELIMINADOS (2026-03-24)

Los siguientes flujos fueron eliminados en la limpieza del 2026-03-24:
- ✅ `kualileal.com/(onboarding)/` — eliminado
- ✅ `app.kualileal.com/(onboarding)/` — eliminado
- ✅ `app.kualileal.com/onboarding/page.tsx` — eliminado
- ✅ `app.kualileal.com/actions/onboarding.ts` — eliminado

El único flujo activo es el de 8 pasos en `app.kualileal.com/(auth)/register/business/`.

---

## Documentación Adicional

- **Guía completa:** `/var/www/ONBOARDING_IMPLEMENTATION_GUIDE.md`
- **Diagramas:** `/var/www/ONBOARDING_FLOW_DIAGRAM.md`
- **Resumen:** `/var/www/IMPLEMENTATION_SUMMARY.md`
- **Fix botón:** `/var/www/FIX_MI_NEGOCIO_BUTTON.md`
- **Deploy:** `/var/www/DEPLOYMENT_COMPLETE.md`

---

**Última actualización:** 2026-03-27
**Estado:** ✅ Producción
**Commits:** 48aede9 (app), d40e48c (main)
