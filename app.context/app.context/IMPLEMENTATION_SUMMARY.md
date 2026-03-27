# Resumen de Implementación: Sistema de Onboarding Progresivo
## Kuali Leal - Arquitectura Completa

---

## ✅ Estado de Implementación

**Todos los archivos del sistema han sido creados y están listos para deployment.**

### Cookies SSO Compartidas
- ✅ Ya configuradas en producción (dominio `.kualileal.com`)
- ✅ Archivos: `app.kualileal.com/src/lib/auth.ts` y `kualileal.com/src/lib/auth.ts`

---

## 📁 Archivos Creados

### 1. Migración de Base de Datos

**Archivo:** `/var/www/app.kualileal.com/migrations/add_onboarding_fields.sql`

```sql
ALTER TABLE users ADD COLUMN business_registration_step VARCHAR(255);
ALTER TABLE users ADD COLUMN has_basic_business_info BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN has_business_module_active BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN has_tax_info BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN has_locations BOOLEAN DEFAULT FALSE;
-- + indexes y timestamps
```

**Ejecutar:**
```bash
mysql -u root -p bdKualiLealApp01 < /var/www/app.kualileal.com/migrations/add_onboarding_fields.sql
```

---

### 2. Tipos TypeScript

**Archivo:** `/var/www/app.kualileal.com/src/types/onboarding.ts`

Define:
- `OnboardingState` interface
- `OnboardingRoute` types
- `ONBOARDING_ROUTES` constant con las 7 rutas exactas
- Helper functions:
  - `getNextOnboardingStep()`
  - `canAccessDashboard()`
  - `getIncompleteOptionalSteps()`

---

### 3. Middleware Inteligente

**Archivo:** `/var/www/app.kualileal.com/src/middleware.new.ts`

Implementa:
- Verificación de sesión compartida
- Redirección automática basada en `business_registration_step`
- Protección de dashboard con `has_business_module_active`
- Permitir acceso a rutas de onboarding en progreso

**Activar:**
```bash
mv /var/www/app.kualileal.com/src/middleware.ts /var/www/app.kualileal.com/src/middleware.old.ts
mv /var/www/app.kualileal.com/src/middleware.new.ts /var/www/app.kualileal.com/src/middleware.ts
```

---

### 4. Funciones de Estado (Backend)

**Archivo:** `/var/www/app.kualileal.com/src/lib/onboarding.ts`

Provee:
- `updateOnboardingState()`: Actualiza DB y sesión
- `getOnboardingState()`: Consulta estado desde DB
- `completeOnboardingStep()`: Marca paso como completado
- `skipOnboardingStep()`: Permite saltar pasos opcionales
- `needsCriticalInfo()`: Verifica si bloquea features

---

### 5. Server Actions

**Archivo:** `/var/www/app.kualileal.com/src/app/actions/onboarding.ts`

Server Actions para usar en páginas:
- `markStepComplete(step)`: Marca completado y redirige
- `skipStep(step)`: Salta paso opcional
- `getOnboardingProgress()`: Obtiene estado actual
- `goToMyBusiness()`: Acción para botón "Mi Negocio"

---

### 6. Componentes UI

#### Banner de Dashboard

**Archivo:** `/var/www/app.kualileal.com/src/components/dashboard/OnboardingBanner.tsx`

Componentes:
- `OnboardingBanner`: Banner principal con links a pasos pendientes
- `GatedFeatureNotice`: Bloqueo visual para features gated

Uso:
```tsx
<OnboardingBanner
  missingTax={!state.has_tax_info}
  missingLocations={!state.has_locations}
/>
```

#### Layout de Onboarding

**Archivo:** `/var/www/app.kualileal.com/src/components/onboarding/OnboardingLayout.tsx`

Wrapper para páginas de onboarding con:
- Barra de progreso visual
- Indicadores de pasos requeridos/opcionales
- UI consistente

---

### 7. Client Hook

**Archivo:** `/var/www/app.kualileal.com/src/hooks/useOnboarding.ts`

Hook para componentes client-side:
```typescript
const { state, loading, hasTaxInfo, hasLocations, canActivatePayments } = useOnboarding();
```

---

### 8. Ejemplos de Implementación

#### Página de Onboarding (Tax)

**Archivo:** `/var/www/app.kualileal.com/src/app/(auth)/register/business/tax/page.new.tsx`

Muestra cómo:
- Integrar `OnboardingLayout`
- Usar `markStepComplete()` al enviar
- Implementar botón "Saltar por el momento"

#### Dashboard Layout

**Archivo:** `/var/www/app.kualileal.com/src/app/(dashboard)/dashboard/layout.new.tsx`

Muestra cómo:
- Obtener estado de onboarding en Server Component
- Renderizar `OnboardingBanner` condicionalmente
- Pasar datos a componentes hijos

---

## 🚀 Pasos de Deployment

### Paso 1: Migración de Base de Datos

```bash
mysql -u root -p bdKualiLealApp01 < /var/www/app.kualileal.com/migrations/add_onboarding_fields.sql
```

Verificar:
```sql
DESCRIBE bdKualiLealApp01.users;
```

### Paso 2: Activar Middleware

```bash
cd /var/www/app.kualileal.com

# Backup del actual
cp src/middleware.ts src/middleware.backup.ts

# Activar nuevo
cp src/middleware.new.ts src/middleware.ts
```

### Paso 3: Actualizar SessionPayload

Los archivos `src/lib/auth.ts` en **ambos dominios** ya fueron actualizados con los campos de onboarding.

✅ `app.kualileal.com/src/lib/auth.ts`
✅ `kualileal.com/src/lib/auth.ts`

### Paso 4: Reemplazar Páginas de Onboarding

Para cada página del flujo (`whatsapp`, `verify-whatsapp`, `info`, `tax`, `locations`, `pricing`):

1. Importar actions:
```typescript
import { markStepComplete, skipStep } from '@/app/actions/onboarding';
```

2. Al completar paso:
```typescript
const handleSubmit = async (formData) => {
  await saveDataAction(formData);
  await markStepComplete('tax'); // auto-redirige
};
```

3. Para pasos opcionales:
```typescript
const handleSkip = () => skipStep('tax');
```

**Referencia:** Ver `src/app/(auth)/register/business/tax/page.new.tsx`

### Paso 5: Actualizar Dashboard Layout

```bash
# Backup
cp src/app/(dashboard)/dashboard/layout.tsx \
   src/app/(dashboard)/dashboard/layout.backup.tsx

# Activar nuevo (con banners)
cp src/app/(dashboard)/dashboard/layout.new.tsx \
   src/app/(dashboard)/dashboard/layout.tsx
```

### Paso 6: Rebuild y Restart

```bash
cd /var/www/app.kualileal.com
npm run build

# Si hay errores de TypeScript, regenerar Prisma Client
npx prisma generate --schema=src/generated/app01/schema.prisma
npx prisma generate --schema=src/generated/app02/schema.prisma

npm run build
pm2 restart app-kualileal
pm2 logs app-kualileal --lines 50
```

---

## 📊 Rutas del Sistema

### Dominio Principal (kualileal.com)

```
GET  /role-selection              # Paso 1: Selección de rol
```

### Subdominio SaaS (app.kualileal.com)

```
GET  /register/business/whatsapp          # Paso 2 (REQUIRED)
GET  /register/business/verify-whatsapp   # Paso 3 (REQUIRED)
GET  /register/business/info              # Paso 4 (REQUIRED) → sets has_basic_business_info
GET  /register/business/tax               # Paso 5 (OPTIONAL) → sets has_tax_info
GET  /register/business/locations         # Paso 6 (OPTIONAL) → sets has_locations
GET  /register/business/pricing           # Paso 7 (REQUIRED) → sets has_business_module_active

GET  /dashboard/inicio                    # Requiere has_business_module_active = true
```

---

## 🧪 Testing Checklist

### Test 1: Session Sharing (SSO Ligero)

```bash
# 1. Login en kualileal.com
# 2. Abrir DevTools → Application → Cookies
# 3. Verificar: kuali_session con domain=.kualileal.com
# 4. Navegar a app.kualileal.com/dashboard/inicio
# 5. Verificar: NO pide login (auto-autenticado)
```

### Test 2: Onboarding Incompleto → Redirección

```sql
UPDATE users
SET
  business_registration_step = 'https://app.kualileal.com/register/business/tax',
  has_basic_business_info = true,
  has_business_module_active = false
WHERE emailUser = 'test@kualileal.com';
```

```bash
# Intentar acceder a /dashboard/inicio
# Debe redirigir a /register/business/tax
```

### Test 3: Skip Step (Pasos Opcionales)

```bash
# 1. Navegar a /register/business/tax
# 2. Clic en "Saltar por el momento"
# 3. Redirige a /register/business/locations
# 4. Verificar en DB: has_tax_info = FALSE
```

### Test 4: Gated Feature (Bloqueo de Stripe)

```sql
UPDATE users
SET
  has_business_module_active = true,
  has_tax_info = false
WHERE emailUser = 'test@kualileal.com';
```

```bash
# 1. Login y acceder a /dashboard/pagos
# 2. Debe mostrar GatedFeatureNotice
# 3. Banner debe aparecer en todas las páginas del dashboard
```

### Test 5: Onboarding Completo

```sql
UPDATE users
SET
  has_business_module_active = true,
  has_basic_business_info = true,
  has_tax_info = true,
  has_locations = true,
  onboarding_completed_at = NOW()
WHERE emailUser = 'test@kualileal.com';
```

```bash
# 1. Login
# 2. Debe redirigir directamente a /dashboard/inicio
# 3. NO debe mostrar banners
```

---

## 📌 Reglas Críticas

### ❌ PROHIBIDO

1. **NO crear rutas genéricas:**
   ```
   ❌ /onboarding
   ❌ /onboarding/step1
   ❌ /setup
   ```

2. **NO redirigir usuarios con `has_business_module_active=true` al onboarding:**
   ```typescript
   // ❌ INCORRECTO
   if (!session.has_tax_info) {
     redirect('/register/business/tax');
   }

   // ✅ CORRECTO
   if (!session.has_business_module_active) {
     redirect(getNextOnboardingStep(session));
   }
   ```

3. **NO bloquear acceso al dashboard si `has_business_module_active=true`:**
   - Aunque falten `has_tax_info` o `has_locations`
   - Mostrar banners persuasivos, NO bloquear entrada

### ✅ REQUERIDO

1. **Siempre usar rutas exactas:**
   ```typescript
   const EXACT_ROUTES = [
     'https://kualileal.com/role-selection',
     'https://app.kualileal.com/register/business/whatsapp',
     // etc.
   ];
   ```

2. **Actualizar sesión después de cambios en DB:**
   ```typescript
   await updateOnboardingState({ userId, has_tax_info: true });
   await updateSession({ has_tax_info: true });
   ```

3. **Permitir skip en pasos opcionales:**
   ```typescript
   // Solo para 'tax' y 'locations'
   <button onClick={() => skipStep('tax')}>Saltar</button>
   ```

---

## 🔧 Troubleshooting

### Error: "Cookie not shared between domains"

**Causa:** Cookie no tiene dominio correcto

**Solución:**
```typescript
// En src/lib/auth.ts, verificar:
if (process.env.NODE_ENV === "production") {
  cookieOpts.domain = ".kualileal.com"; // ← Punto inicial es crítico
}
```

### Error: "Infinite redirect loop"

**Causa:** Middleware redirige a la misma URL

**Solución:**
```typescript
const nextStep = getNextOnboardingStep(session);
if (nextStep && !pathname.includes(nextStep)) {
  redirect(nextStep);
}
```

### Error: "Prisma Client not found"

**Causa:** Cliente no regenerado después de cambios en schema

**Solución:**
```bash
npx prisma generate --schema=src/generated/app01/schema.prisma
npx prisma generate --schema=src/generated/app02/schema.prisma
```

---

## 📚 Documentación Completa

Para detalles de implementación paso a paso, consultar:

**Archivo:** `/var/www/ONBOARDING_IMPLEMENTATION_GUIDE.md`

Incluye:
- Diagramas de flujo
- Ejemplos de código completos
- Scripts de testing
- Comandos de deployment
- Resolución de problemas

---

## 📈 Beneficios del Sistema

### Para el Negocio (Kuali Leal)

- ✅ **Mayor conversión:** Usuarios acceden al dashboard sin completar todo
- ✅ **Reducción de fricción:** Solo 3 pasos obligatorios antes del dashboard
- ✅ **Datos progresivos:** Recolectar info fiscal cuando el usuario esté listo

### Para el Usuario

- ✅ **Inicio rápido:** Ver dashboard en menos pasos
- ✅ **Flexibilidad:** Completar datos fiscales más tarde
- ✅ **Transparencia:** Banners claros sobre qué falta

### Para el Desarrollo

- ✅ **Mantenible:** Lógica centralizada en middleware y helpers
- ✅ **Escalable:** Fácil agregar nuevos pasos al flujo
- ✅ **Testeable:** Estados bien definidos en base de datos

---

## 🎯 Próximos Pasos Recomendados

1. **Ejecutar migración de DB** (crítico)
2. **Activar nuevo middleware** (reemplazar archivo)
3. **Actualizar 1 página de onboarding** (como prueba)
4. **Testear en desarrollo local**
5. **Deploy gradual en producción**
6. **Monitorear métricas de conversión**

---

## 📞 Soporte

Para preguntas sobre esta implementación:
- **Guía técnica:** `/var/www/ONBOARDING_IMPLEMENTATION_GUIDE.md`
- **Resumen:** Este archivo
- **Código de referencia:** Archivos `.new.tsx` en el proyecto

---

**Sistema generado por Claude Code**
**Fecha:** 2026-03-27
**Estado:** ✅ Listo para deployment
