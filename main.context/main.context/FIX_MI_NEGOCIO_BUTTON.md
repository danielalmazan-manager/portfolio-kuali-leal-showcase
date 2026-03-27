# Fix: Botón "Mi Negocio" - Redirección Entre Dominios

## 🐛 Problema Original

El botón "Mi Negocio" en `kualileal.com` simplemente recargaba la página en lugar de redirigir al usuario a `app.kualileal.com`.

**Causa raíz:** El código usaba:
1. ❌ Client-side fetch a `/api/check-business`
2. ❌ `window.location.href` (puede causar problemas de timing)
3. ❌ No tenía Server Action para manejar correctamente el salto entre dominios

---

## ✅ Solución Implementada

### 1. Nueva Server Action en kualileal.com

**Archivo:** [`/var/www/kualileal.com/src/app/actions/onboarding.ts`](file:///var/www/kualileal.com/src/app/actions/onboarding.ts)

```typescript
export async function goToMyBusiness() {
  const session = await getSession();

  if (!session) {
    redirect('https://kualileal.com/login');
  }

  // Obtener estado del usuario desde DB
  const user = await prismaApp01.users.findUnique({
    where: { idUser: session.userId },
    select: {
      business_registration_step: true,
      has_business_module_active: true,
      role: true,
    },
  });

  // REGLA 1: Si es CUSTOMER → role-selection
  if (user.role === 'CUSTOMER') {
    redirect('https://kualileal.com/role-selection');
  }

  // REGLA 2: Si has_business_module_active = TRUE → dashboard
  if (user.has_business_module_active === true) {
    redirect('https://app.kualileal.com/dashboard/inicio'); // ⚠️ URL ABSOLUTA
  }

  // REGLA 3: Si no está completo → siguiente paso del onboarding
  const nextStep = getNextOnboardingStepUrl(user);
  redirect(nextStep); // ⚠️ Siempre URLs absolutas
}
```

**Características clave:**
- ✅ **URLs absolutas** en todos los `redirect()` hacia `app.kualileal.com`
- ✅ Consulta el estado real del usuario en la base de datos
- ✅ Respeta el flujo de onboarding progresivo
- ✅ Maneja fallback si los campos de onboarding no existen aún

---

### 2. Header Actualizado

**Archivo:** [`/var/www/kualileal.com/src/components/Header.tsx`](file:///var/www/kualileal.com/src/components/Header.tsx)

**Antes:**
```typescript
const checkBusinessAndRedirect = async () => {
  const response = await fetch('/api/check-business'); // ❌ Client-side
  const data = await response.json();
  window.location.href = data.redirect; // ❌ Problemático
};
```

**Después:**
```typescript
import { goToMyBusiness } from '@/app/actions/onboarding';

const handleMyBusinessClick = async (e) => {
  e.preventDefault();

  startTransition(async () => {
    await goToMyBusiness(); // ✅ Server Action
    // El redirect es manejado por Next.js
  });
};
```

**Cambios:**
- ✅ Usa `useTransition` para manejar estado de carga
- ✅ Invoca Server Action directamente
- ✅ Muestra indicador de carga (`⏳ Cargando...`)
- ✅ Maneja errores con fallback

---

## 🎯 Lógica de Redirección Implementada

```
Usuario hace clic en "Mi Negocio"
        │
        ▼
Server Action: goToMyBusiness()
        │
        ├─ ¿Sesión válida?
        │   NO → https://kualileal.com/login
        │   YES ↓
        │
        ├─ ¿role = CUSTOMER?
        │   YES → https://kualileal.com/role-selection
        │   NO ↓
        │
        ├─ ¿has_business_module_active = TRUE?
        │   YES → https://app.kualileal.com/dashboard/inicio ✅
        │   NO ↓
        │
        └─ Redirigir a siguiente paso del onboarding
            │
            ├─ Sin step registrado → https://kualileal.com/role-selection
            ├─ Después de role-selection → https://app.kualileal.com/register/business/whatsapp
            ├─ Después de whatsapp → https://app.kualileal.com/register/business/verify-whatsapp
            ├─ Después de verify → https://app.kualileal.com/register/business/info
            ├─ Después de info → https://app.kualileal.com/register/business/tax
            ├─ Después de tax → https://app.kualileal.com/register/business/locations
            └─ Después de locations → https://app.kualileal.com/register/business/pricing
```

---

## 📊 Estado Actual de Tu Usuario

Según los logs de PM2:

```json
{
  "userId": "f8fc3c8a-d35d-436c-8ef1-69fc0097d35d",
  "email": "daniel.almazan@nexuslogicit.com",
  "businessName": "Negocio Demo",
  "idBusiness": 2,
  "statusActive": true
}
```

**Análisis:**
- ✅ Tienes un negocio registrado (`idBusiness: 2`)
- ⚠️ Los campos de onboarding progresivo (`has_business_module_active`) aún no existen en la DB
- 🔧 **Solución temporal:** La Server Action tiene fallback que funciona sin esos campos

---

## 🚀 Cómo Probar

### Test 1: Botón "Mi Negocio" (Desktop)

1. Ir a `https://kualileal.com/`
2. Hacer login si no estás autenticado
3. Hover sobre "Panel" en el navbar
4. Hacer clic en "Mi Negocio"
5. **Resultado esperado:**
   - Muestra "⏳ Cargando..." brevemente
   - Redirige a `https://app.kualileal.com/dashboard/inicio`

### Test 2: Botón "Mi Negocio" (Mobile)

1. Ir a `https://kualileal.com/` en móvil
2. Abrir menú hamburguesa
3. Hacer clic en "Mi Negocio"
4. **Resultado esperado:**
   - Botón muestra "⏳ Cargando..."
   - Redirige a `https://app.kualileal.com/dashboard/inicio`

### Test 3: Usuario sin Negocio

Para probar el flujo completo, necesitarías un usuario sin negocio:

```sql
-- Crear usuario de prueba
INSERT INTO users (idUser, phoneNumber, emailUser, role)
VALUES (UUID(), '+529999999999', 'test@kualileal.com', 'BUSINESS_OWNER');
```

Luego hacer login y clic en "Mi Negocio" → Debería ir a `/register/business/whatsapp`

---

## ⚠️ Importante: Migración de Base de Datos Pendiente

Para que el sistema de onboarding progresivo funcione completamente, necesitas ejecutar:

```bash
mysql -u root -p bdKualiLealApp01 < /var/www/app.kualileal.com/migrations/add_onboarding_fields.sql
```

**Esto agregará:**
- `business_registration_step`
- `has_basic_business_info`
- `has_business_module_active`
- `has_tax_info`
- `has_locations`

**Mientras tanto:**
- ✅ El botón "Mi Negocio" funciona con fallback
- ✅ Redirige correctamente al dashboard si tienes negocio
- ⚠️ No puede trackear progreso exacto del onboarding (solo verifica si tienes negocio en `TableBusiness`)

---

## 🔧 Archivos Modificados

### Creados:
1. `/var/www/kualileal.com/src/app/actions/onboarding.ts` - Server Action nueva

### Modificados:
2. `/var/www/kualileal.com/src/components/Header.tsx` - Botón actualizado
3. `/var/www/kualileal.com/src/components/GoogleAuthRedirect.tsx` - Fix de redirección automática

---

## 🎯 Reglas Críticas Aplicadas

### ✅ URLs Absolutas para Cross-Domain

```typescript
// ❌ INCORRECTO (no funciona entre dominios)
redirect('/dashboard/inicio');

// ✅ CORRECTO
redirect('https://app.kualileal.com/dashboard/inicio');
```

### ✅ Server Actions > Client Fetch

```typescript
// ❌ INCORRECTO
const response = await fetch('/api/check-business');
window.location.href = response.redirect;

// ✅ CORRECTO
await goToMyBusiness(); // Server Action maneja el redirect
```

### ✅ Cookies Compartidas

```typescript
// En createSession() de auth.ts
if (process.env.NODE_ENV === "production") {
  cookieOpts.domain = ".kualileal.com"; // ← Con punto inicial
}
```

---

## 📝 Próximos Pasos Recomendados

1. **Ejecutar migración de DB** (para habilitar onboarding progresivo completo)
2. **Actualizar páginas de onboarding** con `markStepComplete()`
3. **Testing completo** del flujo desde role-selection hasta dashboard
4. **Monitorear logs** para verificar que no hay errores

---

## 🐛 Troubleshooting

### Si el botón sigue recargando la página

**Verificar:**
1. Build exitoso: `npm run build` sin errores
2. PM2 reiniciado: `pm2 restart kuali-leal`
3. Cache del navegador limpiado: Ctrl+Shift+R

### Si redirige a lugar incorrecto

**Revisar logs:**
```bash
pm2 logs kuali-leal --lines 50
```

Buscar líneas con `[goToMyBusiness]` para ver la lógica de decisión.

### Si hay error de Server Action

**Error:** "Failed to find Server Action"

**Solución:**
```bash
cd /var/www/kualileal.com
rm -rf .next
npm run build
pm2 restart kuali-leal
```

---

## ✅ Estado del Fix

- [x] Server Action creada con URLs absolutas
- [x] Header actualizado con `useTransition`
- [x] Manejo de errores implementado
- [x] Indicadores de carga agregados
- [x] Fallback para campos de DB no existentes
- [x] Build exitoso
- [x] Deploy completado
- [x] PM2 reiniciado

**Estado:** ✅ **LISTO PARA PROBAR**

---

**Generado por Claude Code**
Fecha: 2026-03-27
Fix ID: MI_NEGOCIO_CROSS_DOMAIN_REDIRECT
