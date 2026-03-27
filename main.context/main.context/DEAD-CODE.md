# Código Muerto y Legacy — Estado Post-Limpieza 2026-03-24

## ✅ LIMPIEZA COMPLETADA

**Fecha de limpieza:** 2026-03-24
**Estado:** Todos los archivos dead code identificados han sido eliminados

---

## 📋 Archivos eliminados en esta limpieza

### kualileal.com (15 archivos/directorios eliminados)

#### 🔴 Endpoints de debug ELIMINADOS:
- ✅ `src/app/api/debug-business/route.ts` — ELIMINADO
- ✅ `src/app/api/debug-all-businesses/route.ts` — ELIMINADO
- ✅ `src/app/api/debug-business-owner/route.ts` — ELIMINADO

**Nota:** `/api/check-business` fue MANTENIDO y mejorado (ya tenía protección, se optimizó para no exponer datos sensibles).

#### 🟡 Código legacy ELIMINADO:
- ✅ `src/app/(onboarding)/` — Directorio completo ELIMINADO
- ✅ `src/app/(legacy)/` — Directorio completo ELIMINADO
- ✅ `src/app/test-session/` — ELIMINADO
- ✅ `src/components/Hero.tsx` — ELIMINADO (solo se mantiene HeroSection.tsx)

#### 🟢 Scripts y archivos sueltos ELIMINADOS:
- ✅ `query-ids.ts` — ELIMINADO
- ✅ `test-availability.ts` — ELIMINADO
- ✅ `src/lib/mock-data.ts` — ELIMINADO
- ✅ `src/proxy.ts` — ELIMINADO

---

## 📦 Scripts de migración archivados

Todos los scripts de migración ya ejecutados fueron movidos a `src/scripts/_archived/` con un README explicativo.

**Scripts archivados:**
- `migrate-payment-engine.ts`
- `migrate-app01-payment-schema.ts`
- `migrate-business-fields.ts`
- `migrate-email-verification.ts`
- `migrate-subscription-statuses.ts`
- `migrate-visual-records.ts`
- `create-locations-table.ts`

⚠️ **NO volver a ejecutar estos scripts** — ya fueron aplicados en producción.

---

## 🎯 Estado actual: LIMPIO

No hay código muerto conocido en este repositorio. Cualquier nuevo código legacy debe documentarse aquí inmediatamente para limpieza futura.

---

## 📝 Para referencia futura

Si identificas código muerto nuevo:
1. Documentarlo en este archivo
2. Verificar dependencias con `grep -r "nombre-archivo" src/`
3. Confirmar que no rompe funcionalidad activa
4. Eliminarlo o archivarlo según corresponda
5. Actualizar este archivo después de la eliminación

**Última actualización:** 2026-03-24

---

## ⚠️ Pendiente de verificación post-limpieza (2026-03-27)

### app.kualileal.com
- ✅ `dashboard/page.old.tsx` y `page.tsx.backup` — ELIMINADOS.
- ✅ `(legacy)/` — ELIMINADO completamente.
- ✅ `query-ids.ts` y `test-prisma.js` en la raíz — ELIMINADOS.

---

## ✅ Limpieza Phase 1 — 2026-03-26

### app.kualileal.com (6 archivos/directorios eliminados)

- ✅ `src/app/dashboard/page.old.tsx` (~21KB) — versión monolítica del DashboardLayout. ELIMINADO.
- ✅ `src/app/(onboarding)/` — directorio con flujo legacy de onboarding (business-info/, location/). ELIMINADO.
- ✅ `src/app/pricing/page.tsx` — página de precios del flujo legacy (importaba de actions/business.ts). ELIMINADO.
- ✅ `src/app/actions/business.ts` — acciones legacy (`saveBusinessInfoAction`, `saveLocationAction`, `activateBusinessAction`). Reemplazadas por flujo activo en `business-registration.ts`. ELIMINADO.
- ✅ `query-ids.ts` — script de debug en raíz. ELIMINADO.
- ✅ `test-prisma.js` — script de prueba en raíz. ELIMINADO.

**Verificación:** `grep -r "actions/business'" src/` → NO retorna resultados. ✅ Sin importadores huérfanos.
