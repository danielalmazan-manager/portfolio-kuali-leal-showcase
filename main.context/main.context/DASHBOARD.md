## Ubicación y Rutas (Next.js App Router)

El dashboard ha evolucionado de un renderizado condicional a una estructura de rutas reales:

- **Layout Maestro:** `src/app/dashboard/layout.tsx` (Sidebar, Topbar, Notificaciones)
- **Inicio (KPIs):** `/dashboard/inicio/page.tsx`
- **Calendario:** `/dashboard/calendario/page.tsx`
- **Catálogo:** `/dashboard/catalogo/page.tsx`
- **Clientes:** `/dashboard/clientes/page.tsx`
- **Planes:** `/dashboard/plans/page.tsx`

## Flujo de carga

```
1. Usuario visita /dashboard/*
2. middleware.ts verifica sesión (BUSINESS_OWNER/ADMIN/STAFF)
3. dashboard/layout.tsx (Server Component):
   - Recupera businessData once para todo el subárbol
   - Renderiza Navigation (Sidebar) y UserMenu (Topbar)
4. La página específica se renderiza dentro del {children} del layout.
```

## Secciones

### InicioSection (~12KB)
**API:** `GET /api/dashboard/stats`
**Muestra:**
- KPIs del día: citas programadas, ingresos del día, clientes nuevos
- Gráfica de ingresos semanal (Recharts)
- Lista de próximas citas del día

### CalendarioSection (~15KB)
**API:** `GET/POST/PATCH /api/dashboard/appointments`
**Muestra:**
- Vista semanal o mensual interactiva
- Modal para crear nueva cita (selección de servicio, cliente, fecha/hora)
- Modal para editar/cancelar cita existente
- Selector de horarios disponibles (usa lógica de `availability.ts`)

### CatalogoSection (~13KB)
**API:** `GET/POST /api/dashboard/services`
**Muestra:**
- Lista de servicios del negocio
- Formulario para agregar/editar servicio (nombre, descripción, precio, duración)
- Upload de foto por servicio
- Toggle activo/inactivo

### ClientesSection (~11KB)
**API:** `GET /api/dashboard/clients`
**Muestra:**
- Lista de clientes con búsqueda
- Ficha de cliente: contacto, historial de citas, puntos de lealtad
- Filtros por frecuencia de visita

## API Routes del Dashboard

Todas en `src/app/api/dashboard/`:

| Endpoint | Método | Qué hace |
|---|---|---|
| `/api/dashboard/stats` | GET | KPIs: citas del día, ingresos, clientes nuevos |
| `/api/dashboard/appointments` | GET | Lista citas filtradas por businessId y rango de fechas |
| `/api/dashboard/appointments` | POST | Crea nueva cita |
| `/api/dashboard/appointments` | PATCH | Actualiza cita (status, fecha, etc.) |
| `/api/dashboard/clients` | GET | Lista clientes del negocio con paginación |
| `/api/dashboard/services` | GET | Lista servicios del negocio |
| `/api/dashboard/services` | POST | Crea/actualiza servicio |

**IMPORTANTE:** Todas estas APIs DEBEN:
1. Verificar sesión con `getSession()`
2. Filtrar datos por `session.businessId`
3. NUNCA aceptar businessId como query param del cliente

## Componentes de soporte

| Componente | Ubicación | Uso |
|---|---|---|
| `OnboardingChecklist.tsx` | `src/components/` | Checklist de pasos completados (se muestra en InicioSection si hay pasos pendientes) |
| `PlanComparison.tsx` | `src/components/` | Tabla comparativa de planes (se muestra en `/dashboard/plans`) |
| `AnalyticsCharts.tsx` | `src/components/` | Gráficas Recharts (usado en InicioSection) |
| `NotificationCenter.tsx` | `src/components/` | Badge + panel de notificaciones en la topbar |
| `StripeConnectButton.tsx` | `src/app/dashboard/` | Botón para conectar cuenta de pagos Stripe Connect |
| `LogoutButton.tsx` | `src/components/` | Cierra sesión y redirige a kualileal.com |

## Uploads desde el dashboard

| Componente | Qué sube | Endpoint |
|---|---|---|
| `UploadBusinessLogo.tsx` | Logo del negocio (cuadrado) | `/api/upload` |
| `UploadBusinessPhoto.tsx` | Fotos del negocio (múltiples) | `/api/upload` |
| `UploadBusinessImage.tsx` | Imágenes generales | `/api/upload` |
| `UploadTaxDocument.tsx` | Documento fiscal (PDF/imagen) | `/api/upload` |

Todos usan el mismo endpoint `/api/upload` que sube a DigitalOcean Spaces y retorna la URL pública.

## Gestión de planes

`/dashboard/plans` permite cambiar de plan desde el dashboard (para negocios ya activos).

**Diferencia con el onboarding:**
- Onboarding (`/register/business/pricing`) → selección inicial de plan para negocios nuevos
- Dashboard (`/dashboard/plans`) → upgrade/downgrade para negocios existentes

## Archivos muertos en dashboard/
- `page.old.tsx` — versión anterior del dashboard. ELIMINAR.
- `page.tsx.backup` — backup manual. ELIMINAR.

## Mejoras Arquitectónicas (Marzo 2026)

1. ✅ **Layout Descompuesto:** DashboardLayout ya no es un monolito; se utiliza el `layout.tsx` nativo de Next.js y componentes de sección separados.
2. ✅ **URLs por sección:** Implementación de rutas reales (`/dashboard/inicio`, etc.), permitiendo navegación nativa del browser.
3. ✅ **UI Hardening:** Integración completa de **Shadcn/UI** (+49 componentes disponibles). El dashboard ya no depende exclusivamente de HTML/Tailwind ad-hoc.
4. ✅ **API Client (Hardening):** Uso de `apiClient` para manejo automático de sesiones expiradas y errores.

## Próximos pasos
- Migrar secciones restantes a Server Components donde sea posible para mejorar el LCP.
- Implementar esqueletos de carga (Skeleton) específicos por sección.
