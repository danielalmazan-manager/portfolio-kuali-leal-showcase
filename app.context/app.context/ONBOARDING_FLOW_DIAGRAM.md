# Diagrama de Flujo: Sistema de Onboarding Progresivo
## Kuali Leal - Arquitectura Visual

---

## 🎯 Flujo Completo de Usuario

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USUARIO NUEVO (Sin Cuenta)                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 kualileal.com/register                              │
│                 - Email + Password                                  │
│                 - Crea cuenta en DB                                 │
│                 - role = CUSTOMER (default)                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│          🍪 Cookie: kuali_session (domain=.kualileal.com)           │
│          SessionPayload: { userId, email, role: CUSTOMER }          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
╔═════════════════════════════════════════════════════════════════════╗
║              PASO 1: kualileal.com/role-selection                   ║
║              ¿Qué tipo de usuario eres?                             ║
║              [ ] Cliente    [X] Dueño de Negocio                    ║
╚═════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                    UPDATE users SET role = 'BUSINESS_OWNER'
                    UPDATE session: role = 'BUSINESS_OWNER'
                    UPDATE business_registration_step = '/role-selection'
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   🔄 REDIRECCIÓN AUTOMÁTICA                         │
│             kualileal.com → app.kualileal.com                       │
│         (Cookie compartida permite SSO sin re-login)                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
╔═════════════════════════════════════════════════════════════════════╗
║        PASO 2: app.kualileal.com/register/business/whatsapp         ║
║        Ingresa tu número de WhatsApp de negocio                     ║
║        Input: +52 999 999 9999                                      ║
╚═════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                    UPDATE business_registration_step = '.../whatsapp'
                                  │
                                  ▼
╔═════════════════════════════════════════════════════════════════════╗
║    PASO 3: app.kualileal.com/register/business/verify-whatsapp      ║
║    Verifica el código enviado por WhatsApp                          ║
║    Input: [ ][ ][ ][ ][ ][ ]                                        ║
╚═════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                    UPDATE business_registration_step = '.../verify-whatsapp'
                                  │
                                  ▼
╔═════════════════════════════════════════════════════════════════════╗
║         PASO 4: app.kualileal.com/register/business/info            ║
║         🎯 ZONA C - INFORMACIÓN BÁSICA (REQUERIDO)                  ║
║         - Nombre del negocio                                        ║
║         - Categoría                                                 ║
║         - Logo (upload)                                             ║
║         - Descripción                                               ║
╚═════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                    UPDATE has_basic_business_info = TRUE
                    UPDATE business_registration_step = '.../info'
                    INSERT INTO TableBusiness (businessName, logoURL...)
                                  │
                                  ▼
╔═════════════════════════════════════════════════════════════════════╗
║         PASO 5: app.kualileal.com/register/business/tax             ║
║         📋 ZONA D - DATOS FISCALES (OPCIONAL - PUEDE SALTAR)        ║
║         - RFC                                                       ║
║         - Razón Social                                              ║
║         - Dirección Fiscal                                          ║
║                                                                     ║
║         [Guardar y Continuar]  [Saltar por el momento]             ║
╚═════════════════════════════════════════════════════════════════════╝
                    │                           │
          Si completa │                           │ Si hace skip
                    ▼                           ▼
        UPDATE has_tax_info = TRUE    UPDATE business_registration_step = '.../tax'
        INSERT INTO TableTaxData       (NO actualiza has_tax_info)
                    │                           │
                    └───────────┬───────────────┘
                                ▼
╔═════════════════════════════════════════════════════════════════════╗
║      PASO 6: app.kualileal.com/register/business/locations          ║
║      📍 ZONA E - UBICACIONES (OPCIONAL - PUEDE SALTAR)              ║
║      - Dirección física                                             ║
║      - Coordenadas (mapa)                                           ║
║      - Horarios de operación                                        ║
║                                                                     ║
║      [Guardar y Continuar]  [Saltar por el momento]                ║
╚═════════════════════════════════════════════════════════════════════╝
                    │                           │
          Si completa │                           │ Si hace skip
                    ▼                           ▼
    UPDATE has_locations = TRUE    UPDATE business_registration_step = '.../locations'
    INSERT INTO TableCommercialLocations  (NO actualiza has_locations)
                    │                           │
                    └───────────┬───────────────┘
                                ▼
╔═════════════════════════════════════════════════════════════════════╗
║       PASO 7: app.kualileal.com/register/business/pricing           ║
║       💳 ZONA F - PLANES (REQUERIDO)                                ║
║       [ ] FREE      [ ] STARTER ($299/mes)    [ ] PRO ($599/mes)    ║
╚═════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                    UPDATE has_business_module_active = TRUE
                    UPDATE onboarding_completed_at = NOW()
                    UPDATE TableBusiness SET currentPlan = 'STARTER'
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   🎉 ONBOARDING COMPLETADO                          │
│              Redirigir a /dashboard/inicio                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Middleware: Lógica de Acceso

```
Usuario intenta acceder a /dashboard/inicio
                  │
                  ▼
┌─────────────────────────────────────────┐
│  ¿Tiene sesión válida?                  │
│  (cookie kuali_session presente)        │
└─────────────────────────────────────────┘
        │                    │
       NO                   YES
        │                    │
        ▼                    ▼
Redirigir a         ┌─────────────────────────────┐
kualileal.com/login │ ¿role = BUSINESS_OWNER?     │
                    └─────────────────────────────┘
                            │              │
                           NO             YES
                            │              │
                            ▼              ▼
                    Redirigir a   ┌────────────────────────────────┐
                    kualileal.com │ has_business_module_active?    │
                                  └────────────────────────────────┘
                                          │              │
                                         NO             YES
                                          │              │
                                          ▼              ▼
                    ┌───────────────────────────┐  ✅ PERMITIR ACCESO
                    │ Obtener next step desde:  │     AL DASHBOARD
                    │ business_registration_step│
                    └───────────────────────────┘
                                  │
                                  ▼
                        Redirigir a next step
                        (ej: /register/business/tax)
```

---

## 🎯 Banners en Dashboard (Gated Features)

```
Usuario en /dashboard/inicio con:
- has_business_module_active = TRUE
- has_tax_info = FALSE
- has_locations = FALSE

┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  Completa tu perfil para desbloquear todas las funciones     │
│                                                                  │
│  [ ! ] Agregar información fiscal (RFC, régimen fiscal)          │
│        → /register/business/tax                                  │
│                                                                  │
│  [ ! ] Configurar ubicaciones de tu negocio                      │
│        → /register/business/locations                            │
│                                                                  │
│  🚫 Función bloqueada: No podrás activar pagos con Stripe        │
│     hasta que completes tu información fiscal.                   │
│                                                                  │
│                                                          [Cerrar] │
└──────────────────────────────────────────────────────────────────┘
```

### Usuario intenta activar Stripe (has_tax_info = FALSE)

```
/dashboard/pagos

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                          ⚠️                                       │
│                                                                  │
│                   Función bloqueada                              │
│                                                                  │
│  Necesitas completar tu información fiscal para activar          │
│  pagos con Stripe.                                               │
│                                                                  │
│          [Completar información fiscal →]                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Estados de Base de Datos

### Ejemplo 1: Onboarding Incompleto (Stuck en Tax)

```sql
SELECT * FROM users WHERE emailUser = 'usuario@ejemplo.com';
```

```
┌──────────────┬─────────────────────────────────────────────────────────┬──────────────────────────┬──────────────────────────────┬──────────────┬──────────────┐
│ emailUser    │ business_registration_step                              │ has_basic_business_info  │ has_business_module_active   │ has_tax_info │ has_locations│
├──────────────┼─────────────────────────────────────────────────────────┼──────────────────────────┼──────────────────────────────┼──────────────┼──────────────┤
│usuario@ej... │ https://app.kualileal.com/register/business/tax         │ TRUE                     │ FALSE                        │ FALSE        │ FALSE        │
└──────────────┴─────────────────────────────────────────────────────────┴──────────────────────────┴──────────────────────────────┴──────────────┴──────────────┘
```

**Comportamiento:**
- ❌ NO puede acceder a `/dashboard/inicio`
- ✅ Middleware redirige a `/register/business/tax`

---

### Ejemplo 2: Onboarding Completo (Saltó pasos opcionales)

```sql
SELECT * FROM users WHERE emailUser = 'usuario2@ejemplo.com';
```

```
┌──────────────┬─────────────────────────────────────────────────────────┬──────────────────────────┬──────────────────────────────┬──────────────┬──────────────┐
│ emailUser    │ business_registration_step                              │ has_basic_business_info  │ has_business_module_active   │ has_tax_info │ has_locations│
├──────────────┼─────────────────────────────────────────────────────────┼──────────────────────────┼──────────────────────────────┼──────────────┼──────────────┤
│usuario2@e... │ https://app.kualileal.com/register/business/pricing     │ TRUE                     │ TRUE                         │ FALSE        │ FALSE        │
└──────────────┴─────────────────────────────────────────────────────────┴──────────────────────────┴──────────────────────────────┴──────────────┴──────────────┘
```

**Comportamiento:**
- ✅ PUEDE acceder a `/dashboard/inicio`
- ⚠️ Ve banner de pasos pendientes
- 🚫 NO puede activar Stripe (bloqueado por `has_tax_info = FALSE`)

---

### Ejemplo 3: Onboarding 100% Completo

```sql
SELECT * FROM users WHERE emailUser = 'usuario3@ejemplo.com';
```

```
┌──────────────┬─────────────────────────────────────────────────────────┬──────────────────────────┬──────────────────────────────┬──────────────┬──────────────┐
│ emailUser    │ business_registration_step                              │ has_basic_business_info  │ has_business_module_active   │ has_tax_info │ has_locations│
├──────────────┼─────────────────────────────────────────────────────────┼──────────────────────────┼──────────────────────────────┼──────────────┼──────────────┤
│usuario3@e... │ https://app.kualileal.com/register/business/pricing     │ TRUE                     │ TRUE                         │ TRUE         │ TRUE         │
└──────────────┴─────────────────────────────────────────────────────────┴──────────────────────────┴──────────────────────────────┴──────────────┴──────────────┘
```

**Comportamiento:**
- ✅ PUEDE acceder a `/dashboard/inicio`
- ✅ NO ve banners de pasos pendientes
- ✅ PUEDE activar Stripe y todas las funciones

---

## 🔄 Botón "Mi Negocio" en Navbar

```
Usuario hace clic en "Mi Negocio" (navbar de kualileal.com)
                  │
                  ▼
        Server Action: goToMyBusiness()
                  │
                  ▼
        ┌─────────────────────────┐
        │ ¿Tiene sesión?          │
        └─────────────────────────┘
                  │
              NO  │  YES
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
Redirigir a        ┌──────────────────────────┐
/login             │ has_business_module_     │
                   │ active = TRUE?           │
                   └──────────────────────────┘
                            │
                        NO  │  YES
                            │
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
    Obtener next step      Redirigir a
    y redirigir            /dashboard/inicio
    (ej: .../tax)
```

---

## 🎨 Indicador de Progreso en UI

```
Paso actual: Tax (5/7)

┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│  ✅  │  ✅  │  ✅  │  ✅  │  🔵  │  ⚪  │  ⚪  │
│WhatsA│Verif│ Info│     │ Tax │Locat│ Plan│
│  pp  │     │     │     │     │ ions│     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
  1      2      3      4      5      6      7
 REQ    REQ    REQ    --     OPT    OPT    REQ

✅ = Completado
🔵 = Actual
⚪ = Pendiente
REQ = Requerido
OPT = Opcional (puede saltar)
```

---

## 🔐 Cookie Sharing (SSO Ligero)

```
┌───────────────────────────────────────────────────────────────┐
│                    kualileal.com                              │
│  Usuario hace login                                           │
│  Server crea JWT: { userId, email, role: BUSINESS_OWNER }    │
│                                                               │
│  Set-Cookie: kuali_session=<JWT>                             │
│              domain=.kualileal.com  ← ⚠️ Punto inicial        │
│              httpOnly=true                                    │
│              secure=true                                      │
│              sameSite=lax                                     │
└───────────────────────────────────────────────────────────────┘
                          │
                          ▼
            🍪 Cookie guardada en navegador
               domain: .kualileal.com
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│              Usuario navega a app.kualileal.com               │
│                                                               │
│  GET /dashboard/inicio                                        │
│  Cookie: kuali_session=<JWT>  ← ✅ Enviada automáticamente    │
└───────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│          app.kualileal.com Middleware                         │
│  Leer cookie → Verificar JWT → Extraer session               │
│  ✅ Usuario autenticado sin re-login                          │
└───────────────────────────────────────────────────────────────┘
```

### ⚠️ Crítico: Configuración del Dominio

```typescript
// ❌ INCORRECTO
cookieOpts.domain = "kualileal.com";  // Sin punto inicial

// ✅ CORRECTO
cookieOpts.domain = ".kualileal.com"; // Con punto inicial
```

**Por qué el punto es importante:**
- `.kualileal.com` → Cookie compartida con **todos** los subdominios
- `kualileal.com` → Cookie **solo** para el dominio exacto (no subdominios)

---

## 📂 Estructura de Archivos Implementados

```
/var/www/
├── ONBOARDING_IMPLEMENTATION_GUIDE.md    # Guía completa
├── IMPLEMENTATION_SUMMARY.md             # Resumen ejecutivo
├── ONBOARDING_FLOW_DIAGRAM.md            # Este archivo
│
└── app.kualileal.com/
    ├── migrations/
    │   └── add_onboarding_fields.sql     # Migración de DB
    │
    ├── src/
    │   ├── types/
    │   │   └── onboarding.ts             # Tipos y helpers
    │   │
    │   ├── lib/
    │   │   ├── auth.ts                   # SessionPayload extendido
    │   │   └── onboarding.ts             # Funciones de estado
    │   │
    │   ├── app/
    │   │   ├── actions/
    │   │   │   └── onboarding.ts         # Server actions
    │   │   │
    │   │   ├── (auth)/register/business/
    │   │   │   └── tax/
    │   │   │       └── page.new.tsx      # Ejemplo
    │   │   │
    │   │   └── (dashboard)/dashboard/
    │   │       └── layout.new.tsx        # Con banners
    │   │
    │   ├── components/
    │   │   ├── dashboard/
    │   │   │   └── OnboardingBanner.tsx  # Banners
    │   │   │
    │   │   └── onboarding/
    │   │       └── OnboardingLayout.tsx  # Layout wrapper
    │   │
    │   ├── hooks/
    │   │   └── useOnboarding.ts          # Client hook
    │   │
    │   └── middleware.new.ts             # Middleware inteligente
    │
    └── [Deploy después de testing]
```

---

## 🚀 Estado de Implementación

### ✅ COMPLETADO

- [x] Migración de base de datos escrita
- [x] Tipos TypeScript definidos
- [x] Middleware inteligente implementado
- [x] Server actions creadas
- [x] Componentes UI (banners, layouts)
- [x] Hooks de cliente
- [x] Ejemplos de integración
- [x] Documentación completa
- [x] Guía de troubleshooting

### ⏳ PENDIENTE (Deployment)

- [ ] Ejecutar migración en DB
- [ ] Activar nuevo middleware
- [ ] Actualizar páginas de onboarding
- [ ] Actualizar dashboard layout
- [ ] Testing en producción
- [ ] Monitoreo de métricas

---

**Generado por Claude Code**
**Fecha:** 2026-03-27
