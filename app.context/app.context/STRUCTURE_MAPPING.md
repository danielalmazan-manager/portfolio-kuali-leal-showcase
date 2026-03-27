# Mapeo Estructural: app.kualileal.com

Este documento detalla la estructura del repositorio del Dashboard y el flujo de negocio.

## 📁 Raíz del Proyecto
- `prisma/` → Schemas duales (schema_01, schema_02) sincronizados.
- `src/` → Código fuente principal.
- `ecosystem.config.js` → Configuración de despliegue con PM2.

## 📂 src/app/ (Next.js App Router)
- `(auth)/register/business/` → **Onboarding de Negocio** (8 pasos: WhatsApp, Tax, Locations, Pricing, Stripe).
- `dashboard/` → **Módulo Principal del Negocio**
  - `layout.tsx` → UI persistente (Sidebar, Topbar).
  - `inicio/` → KPIs y resumen diario.
  - `calendario/` → Gestión de citas e intervalos de tiempo.
  - `catalogo/` → Administración de servicios y precios.
  - `clientes/` → CRM básico y lealtad.
  - `plans/` → Selección de suscripción (Billing).
- `api/`
  - `upload/` → Endpoint unificado para DigitalOcean Spaces.
  - `auth/` → Integración con NextAuth (Google Callback).
- `error.tsx`, `not-found.tsx`, `loading.tsx` → UX de producción endurecida.

## 📂 src/lib/ (Lógica de Negocio)
- `api-client.ts` → Fetch wrapper con auto-redirect ante 401.
- `auth.ts` → Core de autenticación (getSession, roles).
- `env.ts` → Validación estricta de variables con Zod (Fail-Fast).
- `rate-limit.ts` → Protección de endpoints (OTP, Auth, Uploads).
- `prisma.ts` → Instancias duales de Prisma.
- `storage.ts` → Interfaz con S3/DO Spaces.
- `stripe.ts` → Lógica de cobros y webhooks.

## 📂 src/components/
- `ui/` → Biblioteca de 49+ componentes **Shadcn/UI**.
- `dashboard/` → Fragmentos reactivos del Dashboard.
- `OnboardingChecklist.tsx` → Guía de pasos para negocios nuevos.
- `PlanComparison.tsx` → Tabla de planes Stripe.

## 📂 src/scripts/
- `migrate-otp-expiry.ts` → Script para añadir expiración a OTP.
- `migrate-business-slugs.ts` → Script para añadir soporte de URLs amigables.
- `seed-db.ts` → Poblado de catálogos base (México).
