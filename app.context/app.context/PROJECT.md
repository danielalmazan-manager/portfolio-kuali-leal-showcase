# Kuali Leal — Contexto del Proyecto

## Qué es
Plataforma SaaS para negocios locales en México (salones de belleza, barberías, spas, consultorios, etc.). Permite a dueños de negocio gestionar citas, catálogo de servicios, clientes, puntos de lealtad, y recibir pagos. Los clientes finales pueden descubrir negocios, reservar citas, y acumular puntos.

## Arquitectura de 2 dominios

### kualileal.com (puerto 3000)
- Landing page pública
- Auth: login, registro, selección de rol
- Redirige al dashboard en app.kualileal.com
- Página de precios
- Booking público (stub)
- Módulos futuros: fintech, portal cliente

### app.kualileal.com (puerto 3001)
- Dashboard operativo para BUSINESS_OWNER / ADMIN / STAFF
- Flujo completo de registro de negocio (8 pasos con Stripe)
- Secciones del dashboard: Inicio (KPIs), Calendario, Catálogo, Clientes
- API routes para datos del dashboard
- Middleware que controla acceso por rol

### Comunicación entre dominios
- Cookie JWT `kuali_session` compartida en dominio `.kualileal.com`
- NO hay API de comunicación directa entre los dos servidores
- Ambos repos se conectan a las MISMAS 2 bases de datos

## Stack técnico
- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma ORM con 2 bases de datos separadas:
  - **App01** → `prismaApp01` → `@prisma/client-app01` → Usuarios, autenticación, roles, verificación
  - **App02** → `prismaApp02` → `@prisma/client-app02` → Negocios, servicios, citas, pagos, lealtad, staff
- Auth: JWT propio firmado con `jose`. NextAuth v5 SOLO para Google OAuth callback.
- UI: shadcn/ui (Radix UI + Tailwind CSS)
- Pagos: Stripe (Subscriptions para plataforma + Connect para que negocios reciban pagos)
- Storage: DigitalOcean Spaces (API compatible S3) vía AWS SDK
- Email: Resend (transaccional)
- WhatsApp: Meta Cloud API (OTP en onboarding)
- Deploy: PM2 en VPS con Ubuntu, variables en `/var/config/`

## Roles de usuario
| Rol | Acceso | Descripción |
|---|---|---|
| CUSTOMER | kualileal.com | Cliente final que reserva citas |
| BUSINESS_OWNER | app.kualileal.com/dashboard | Dueño del negocio registrado |
| ADMIN | app.kualileal.com/dashboard | Administrador con permisos ampliados |
| STAFF | app.kualileal.com/dashboard | Personal del negocio con permisos limitados |

## Roles internos de negocio (TableUserPlanBusiness)
| Valor | Rol | Permisos |
|---|---|---|
| 1 | OWNER | Todo, incluido billing y settings |
| 2 | ADMIN | Gestión completa excepto billing |
| 3 | STAFF | Solo operación (citas, clientes) |

| Módulo | Estado | Ubicación |
|---|---|---|
| Auth (email + Google) | ✅ Funcional | kualileal.com/(auth)/ |
| Landing pública | ✅ Funcional | kualileal.com/(01-core)/ |
| Onboarding negocio (8 pasos) | ✅ Funcional | app.kualileal.com/(auth)/register/business/ |
| Dashboard - Inicio | ✅ Funcional | app.kualileal.com/dashboard/inicio (Server-rendered) |
| Dashboard - Calendario | ✅ Funcional | app.kualileal.com/dashboard/calendario (Server-rendered) |
| Dashboard - Catálogo | ✅ Funcional | app.kualileal.com/dashboard/catalogo (Client-rendered) |
| Dashboard - Clientes | ✅ Funcional | app.kualileal.com/dashboard/clientes (Client-rendered) |
| Planes y suscripciones | ✅ Funcional | Stripe integration |
| Sistema de lealtad | 🔨 Básico | src/lib/loyalty.ts en ambos repos |
| Booking público | ✅ Funcional | kualileal.com/reserva/[slug] (Fase 2.1) |
| Fintech | ⬜ No iniciado | kualileal.com/(03-fintech)/ — vacío |
| Portal cliente | ⬜ No iniciado | kualileal.com/(04-client)/ — vacío |

## Problemas conocidos de arquitectura (post-limpieza 2026-03-24)
1. **DashboardLayout monolítico** (20KB): renderizado condicional en vez de rutas. Pendiente migración a rutas reales.
2. **Server Actions con nombre colisionante**: `saveBusinessInfoAction` en dos archivos de app.kualileal.com.
3. **OTP sin expiración**: verificationCode no tiene timestamp en Users.
4. **stripeCustomerId ambiguo**: existe en Users y TableBusiness sin documentación clara de propósito.
5. **Webhooks sin idempotencia**: pueden reprocesar eventos duplicados de Stripe.
6. **Módulo de booking vacío**: los clientes no pueden reservar citas todavía.
7. **Solo 2 componentes shadcn/ui en app.kualileal.com**: el dashboard usa HTML directo.

## Evolución de Arquitectura (Logros 2026-03)
1. ✅ **DashboardLayout monolítico** → Migrado a rutas Next.js reales.
2. ✅ **Idempotencia Stripe** → Implementado en webhooks de suscripciones y pagos.
3. ✅ **OTP con expiración** → `verificationCodeExpiry` implementado y validado.
4. ✅ **Módulo de Booking** → Motor de reservas funcional con slugs dinámicos.
5. ✅ **UI Hardening** → Integración de Shadcn/UI en el dashboard de la App.
6. ✅ **Producción Hardening** → Global Error Boundaries, ENV validation y Rate Limiting.

## Reglas para la IA
1. NUNCA usar `getServerSession()` de NextAuth para auth. SIEMPRE usar `getSession()` de `@/lib/auth.ts`.
2. SIEMPRE especificar qué Prisma client usar: `prismaApp01` (usuarios) o `prismaApp02` (negocios).
3. Server Actions: `'use server'`, validar con Zod, try/catch, retornar `{success, error?, data?}`.
4. NO hacer `$transaction` cross-database (son BDs separadas).
5. Uploads van a `/api/upload` → DigitalOcean Spaces. NO escribir uploads directos a S3.
6. NO modificar archivos en `(legacy)/`. Están pendientes de eliminación.
7. NO instalar librerías de UI nuevas. Usar shadcn/ui existente.
8. Todo cambio de schema requiere script de migración en `src/scripts/`.
9. Los schemas Prisma DEBEN ser idénticos en ambos repos.
10. Al modificar `auth.ts` en un repo, SIEMPRE sincronizar con el otro.
