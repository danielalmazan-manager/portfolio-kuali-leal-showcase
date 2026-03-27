# Arquitectura y Decisiones Técnicas

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      INTERNET                            │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
    ┌──────▼──────┐       ┌──────▼──────┐
    │ kualileal.com│       │app.kualileal│
    │  :3000 (PM2) │       │  :3001 (PM2) │
    │              │       │              │
    │ Landing      │       │ Dashboard    │
    │ Auth         │       │ Onboarding   │
    │ Booking pub  │       │ API data     │
    │ Pricing      │       │ Webhooks     │
    └──────┬──────┘       └──────┬──────┘
           │                      │
           │   Cookie JWT         │
           │  kuali_session       │
           │  (.kualileal.com)    │
           │                      │
    ┌──────▼──────────────────────▼──────┐
    │          Base de Datos              │
    │                                    │
    │  ┌─────────┐    ┌──────────────┐  │
    │  │  App01   │    │    App02     │  │
    │  │ Usuarios │    │  Negocios   │  │
    │  │ Auth     │    │  Servicios  │  │
    │  │ Roles    │    │  Citas      │  │
    │  │          │    │  Pagos      │  │
    │  │          │    │  Lealtad    │  │
    │  └─────────┘    └──────────────┘  │
    └────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  Servicios   │
    │  Externos    │
    │              │
    │ • Stripe     │
    │ • Resend     │
    │ • WhatsApp   │
    │ • DO Spaces  │
    │ • Google OAuth│
    └──────────────┘
```

## ¿Por qué 2 repos separados?

**Decisión:** Separar el frontend público (kualileal.com) del dashboard operativo (app.kualileal.com) en dos proyectos Next.js independientes.

**Razones:**
- Despliegue independiente: se puede actualizar el dashboard sin tocar la landing
- Seguridad: el subdominio operativo tiene middleware estricto; la landing es pública
- Performance: el bundle del dashboard (Recharts, Calendar, formularios complejos) no afecta el time-to-first-byte de la landing

**Tradeoff:** Duplicación de código compartido (auth, prisma, utils). No se implementó un monorepo ni un paquete compartido.

**Consecuencia práctica:** TODO cambio en archivos compartidos (auth.ts, schemas Prisma, etc.) DEBE replicarse manualmente en ambos repos.

## ¿Por qué 2 bases de datos?

**Decisión:** App01 para identidad de usuarios, App02 para lógica de negocio.

**Razones:**
- Separación de concerns: datos de usuario/auth aislados de datos comerciales
- Escalabilidad futura: la DB de negocios puede escalar independientemente
- Seguridad: si comprometen la app de negocio, no tienen acceso directo a passwords

**Tradeoff:** No se pueden hacer JOINs cross-database ni $transaction entre ambas. Hay que hacer queries secuenciales y manejar consistencia manualmente.

**Consecuencia práctica:** Cuando necesitas datos del usuario Y del negocio, haces 2 queries separados:
```typescript
const user = await prismaApp01.users.findUnique({ where: { id: userId } });
const business = await prismaApp02.tableBusiness.findFirst({ where: { userId } });
```

## ¿Por qué JWT propio + NextAuth?

**Decisión:** Motor de sesiones JWT propio con `jose` como sistema principal, NextAuth v5 solo como wrapper de Google OAuth.

**Razones:**
- Control total del payload del JWT (userId, email, role, businessId)
- Cookie compartida entre dominios (`.kualileal.com`) — NextAuth no maneja esto bien con subdominios
- Simplificación: una sola cookie para ambos dominios

**Tradeoff:** Complejidad del flujo de Google OAuth, que requiere sincronización (`/api/auth/sync`) entre la sesión de NextAuth y el JWT propio.

**Consecuencia práctica:** NUNCA usar funciones de sesión de NextAuth. Siempre usar `getSession()` de `src/lib/auth.ts`.

## Estructura de rutas (App Router)

### Route Groups (carpetas con paréntesis)
Los route groups NO crean segmentos de URL:
- `(auth)/login/page.tsx` → URL: `/login`
- `(01-core)/page.tsx` → URL: `/`
- `(legacy)/admin/points/page.tsx` → URL: `/admin/points`

### Convención de numeración
- `(01-core)` — funcionalidad central
- `(02-booking)` — módulo de reservas
- `(03-fintech)` — módulo financiero (futuro)
- `(04-client)` — portal de cliente (futuro)

Esta numeración indica prioridad de desarrollo, no jerarquía técnica.

## DashboardLayout: arquitectura interna

El dashboard en `app.kualileal.com` NO usa rutas de Next.js para las secciones. Es un Single Page Application dentro de Next.js:

```
/dashboard (Server Component)
  └── DashboardLayout (Client Component, 20KB)
       ├── Sidebar (links de navegación)
       ├── TopBar (notificaciones, avatar)
       └── Content Area (renderizado condicional)
            ├── activeSection === 'inicio' → <InicioSection />
            ├── activeSection === 'calendario' → <CalendarioSection />
            ├── activeSection === 'catalogo' → <CatalogoSection />
            └── activeSection === 'clientes' → <ClientesSection />
```

**Implicación:** No hay URLs separadas para cada sección (/dashboard/calendar, /dashboard/catalog). Todo es `/dashboard` con estado interno. Esto limita la navegabilidad (no se puede compartir link a una sección) y el SEO (irrelevante para dashboard privado).

## Servicios externos

### Stripe
- **Subscriptions:** El negocio paga plan mensual (FREE/STARTER/PRO) a Kuali Leal
- **Connect:** Kuali Leal actúa como plataforma; los negocios reciben pagos de sus clientes
- **Elements:** Formulario de pago embebido en el paso 7 del onboarding
- **Webhooks:** Confirman pagos y actualizan estado de suscripciones

### DigitalOcean Spaces
- Compatible con API de S3
- Almacena: logos de negocios, fotos, documentos fiscales
- Acceso vía AWS SDK (`@aws-sdk/client-s3`)
- La URL pública se guarda en la BD

### WhatsApp (Meta Cloud API)
- Solo se usa en el paso 1 del onboarding para enviar OTP
- Números mexicanos se formatean con prefijo +521
- Template pre-aprobado en Meta Business Manager

### Resend
- Emails transaccionales: verificación de cuenta, confirmación de cita, bienvenida
- No se usa para marketing/newsletters

## Variables de entorno críticas

```
# Compartidas entre repos
JWT_SECRET                    # Firmar/verificar JWTs — DEBE ser idéntico en ambos repos
DATABASE_URL_APP01            # Conexión a BD de usuarios
DATABASE_URL_APP02            # Conexión a BD de negocios

# Stripe
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO

# Google OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

# DigitalOcean Spaces
DO_SPACES_ENDPOINT
DO_SPACES_KEY
DO_SPACES_SECRET
DO_SPACES_BUCKET

# WhatsApp
WHATSAPP_TOKEN
WHATSAPP_PHONE_ID

# Email
RESEND_API_KEY

# App
NEXTAUTH_SECRET
NEXTAUTH_URL                  # Diferente en cada repo
NEXT_PUBLIC_APP_URL           # URL del propio dominio
NEXT_PUBLIC_MAIN_URL          # URL de kualileal.com
```
