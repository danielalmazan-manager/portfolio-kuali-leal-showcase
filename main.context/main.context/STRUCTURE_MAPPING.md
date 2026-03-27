# Mapeo Estructural: kualileal.com

Este documento detalla la estructura del repositorio de la Landing Page y el Motor de Reservas.

## 📁 Raíz del Proyecto
- `src/app/` → Rutas públicas y de autenticación unificada.
- `src/lib/` → Utilidades de sistema (WhatsApp, Auth, Stripe).
- `ecosystem.config.js` → Configuración de PM2 para el servidor de producción.

## 📂 src/app/ (Next.js App Router)
- `(01-core)/` → Landing page, SEO, y secciones de marketing.
- `(auth)/` → **Auth Unificado** (Login, Registro, Selección de Rol, Error páginas).
- `reserva/[slug]/` → **Motor de Reservas (Fase 2.1)**
  - `page.tsx` → Carga dinámica del negocio por slug.
  - `BookingFlow.tsx` → Componente reactivo de flujo de citas.
- `api/`
  - `payments/create-intent/` → Creación de pagos Stripe (B2C).
  - `availability/` → Consulta de slots libres en tiempo real.
  - `webhooks/stripe/` → Handler con guardas de idempotencia.

## 📂 src/lib/ (Lógica de Sistema)
- `availability.ts` → Motor de cálculo de horarios y bloqueos (calendar logic).
- `whatsapp.ts` → Integración con Meta Cloud API para OTP.
- `rate-limit.ts` → Protección de endpoints sensibles (Citas, Auth, Pagos).
- `stripe.ts` → Instancia de Stripe y utilidades de precios.
- `env.ts` → Validación de variables (Stripe Keys, DB URLs).

## 📂 src/components/
- `booking/` → Fragmentos del motor de reservas.
- `ui/` → Biblioteca compartida de componentes Shadcn.
- `HeroSection.tsx`, `Header.tsx`, `Footer.js` → Bloques de la landing page.
- `SendOTPButton.tsx` → Componente de envío de códigos WhatsApp.

## 📂 src/scripts/
- `seed-db.ts` → Poblado de categorías y regímenes (México).
- `migrate-otp-expiry.ts` → Sincronización de schema de seguridad.
