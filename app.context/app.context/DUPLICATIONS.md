# Duplicaciones entre Repos — Estado Post-Sincronización 2026-03-24

## ✅ SINCRONIZACIÓN COMPLETADA

**Fecha de sincronización:** 2026-03-24
**Estado:** Archivos críticos sincronizados, divergencias documentadas

---

## 🔄 Archivos SINCRONIZADOS (idénticos o correctamente diferentes)

### ✅ Archivos críticos IDÉNTICOS

Estos archivos son idénticos en ambos repos y DEBEN mantenerse sincronizados:

| Archivo | Estado | Última verificación |
|---|---|---|
| `src/lib/auth.ts` | ✅ SINCRONIZADO | 2026-03-24 |
| `src/lib/email.ts` | ✅ IDÉNTICO | 2026-03-24 |
| `src/lib/storage.ts` | ✅ IDÉNTICO | 2026-03-24 |
| `src/lib/loyalty.ts` | ✅ IDÉNTICO | 2026-03-24 |
| `src/lib/rate-limit.ts` | ✅ IDÉNTICO | 2026-03-24 |
| `src/lib/utils.ts` | ✅ IDÉNTICO | 2026-03-24 |

### ✅ Schemas Prisma SINCRONIZADOS

**CRÍTICO:** Estos archivos fueron sincronizados el 2026-03-24.

| Schema | Estado | Campos agregados a kualileal.com |
|---|---|---|
| `prisma/schema_01.prisma` | ✅ SINCRONIZADO | `stripeCustomerId`, `stripeSubscriptionId` en Users |
| `prisma/schema_02.prisma` | ✅ SINCRONIZADO | `taxDocumentKey` en TableTaxData |

**Fuente de verdad:** app.kualileal.com (tiene los campos más recientes)

**Diferencias permitidas:**
- `output`: kualileal.com usa `../node_modules/@prisma/client-app0X`, app usa `../src/generated/app0X`
- `binaryTargets`: app.kualileal.com incluye targets para deployment

⚠️ **REGLA:** Cualquier cambio en schemas debe aplicarse en AMBOS repos simultáneamente.

### ⚠️ Archivos correctamente DIFERENTES

Estos archivos son diferentes por razones arquitectónicas válidas:

#### `src/lib/prisma.ts`
- **Diferencia:** Import paths (`@generated/app0X` vs `@prisma/client-app0X`)
- **Razón:** Estructura de carpetas diferente en cada proyecto
- **Acción:** Mantener diferentes ✅

#### `src/lib/stripe.ts`
- **Diferencia:** app.kualileal.com tiene versión completa con `STRIPE_PRICES`, `getPriceIdForPlan()`, `publishableKey`, `webhookSecret`
- **Razón:** app maneja suscripciones, kualileal.com solo necesita client básico
- **Acción:** Mantener diferentes ✅

---

## 📋 Checklist de sincronización post-cambio

Después de modificar cualquier archivo compartido:

- [ ] ¿El cambio afecta la firma/verificación del JWT? → Actualizar `auth.ts` en AMBOS repos
- [ ] ¿El cambio agrega/modifica un campo de BD? → Actualizar schema en AMBOS repos + regenerar Prisma clients + crear migración
- [ ] ¿El cambio modifica parámetros de Stripe? → Actualizar `stripe.ts` en AMBOS repos (si aplica)
- [ ] ¿El cambio modifica templates de email? → Actualizar `email.ts` en AMBOS repos
- [ ] ¿El cambio modifica configuración de storage? → Actualizar `storage.ts` en AMBOS repos

---

## 🔍 Cómo verificar sincronización

```bash
# Comparar archivos específicos
diff /var/www/kualileal.com/src/lib/auth.ts /var/www/app.kualileal.com/src/lib/auth.ts

# Comparar schemas
diff /var/www/kualileal.com/prisma/schema_01.prisma /var/www/app.kualileal.com/prisma/schema_01.prisma

# Verificar múltiples archivos
for file in src/lib/{email,storage,loyalty,rate-limit,utils}.ts; do
  echo "=== $file ==="
  diff -q /var/www/kualileal.com/$file /var/www/app.kualileal.com/$file
done
```

---

## ⚠️ Problemas conocidos NO resueltos

### 1. Server Actions con nombres colisionantes (app.kualileal.com)

**Problema:** Hay `saveBusinessInfoAction` en dos archivos:
- `actions/business.ts` (CRUD simplificado)
- `actions/business-registration.ts` (onboarding de 8 pasos)

**Impacto:** Posible confusión de imports

**Recomendación futura:** Renombrar el legacy a `saveBusinessInfoLegacyAction` o eliminarlo

---

## 📝 Solución ideal (no implementada)

Para eliminar TODA duplicación, migrar a monorepo:

```
kuali-leal/
├── packages/
│   └── shared/          # auth, prisma, email, storage, utils, schemas
├── apps/
│   ├── web/             # kualileal.com
│   └── dashboard/       # app.kualileal.com
└── package.json         # workspace root
```

Por ahora, la sincronización manual con este checklist es la solución pragmática.

**Última actualización:** 2026-03-24
