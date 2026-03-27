# Base de Datos — Kuali Leal

## Arquitectura

Dos bases de datos PostgreSQL separadas, cada una con su propio Prisma Client.

| Base de Datos | Prisma Client | Import | Dominio |
|---|---|---|---|
| App01 | `prismaApp01` | `import { prismaApp01 } from '@/lib/prisma'` | Usuarios, auth, roles |
| App02 | `prismaApp02` | `import { prismaApp02 } from '@/lib/prisma'` | Negocios, servicios, citas, pagos, lealtad |

**Los schemas Prisma están en `prisma/schema_01.prisma` y `prisma/schema_02.prisma` en AMBOS repos y DEBEN ser idénticos.**

## App01 — Tablas

### users (App01)
```prisma
model users {
  idUser                 String                   @id @db.Char(36)
  phoneNumber            String                   @unique @db.VarChar(20)
  nameUser               String?                  @db.VarChar(100)
  emailUser              String?                  @db.VarChar(100)
  emailVerifield         Boolean?                 @default(false)     // NOTA: Typo histórico en BD
  verificationCode       String?                  @db.VarChar(6)
  verificationCodeExpiry DateTime?                                    // Agregado en Fase 1.3
  passwordHash           String?                  @db.VarChar(255)
  role                   users_role?              @default(CUSTOMER)
  stripeCustomerId       String?                  @db.VarChar(100)
  createdAt              DateTime?                @default(now())
}
```

## App02 — Tablas principales

### TableBusiness (App02)
```prisma
model TableBusiness {
  idBusiness           Int                               @id @default(autoincrement())
  idUserOwner          String                            @db.Char(36)
  businessName         String?                           @db.VarChar(255)
  slug                 String?                           @unique            // Agregado en Fase 2.1
  businessDescription  String?                           @db.Text
  logoURL              String?                           @db.VarChar(255)
  currentPlan          TableBusiness_currentPlan?        @default(FREE)
  stripeAccountId      String?                           @db.VarChar(255)
  stripeCustomerId     String?                           @db.VarChar(255)
  subscriptionStatus   TableBusiness_subscriptionStatus? @default(incomplete)
  subscriptionId       String?                           @db.VarChar(100)
  payoutsEnabled       Boolean?
  chargesEnabled       Boolean?
  createdAt            DateTime?                         @default(now())
}
```

### TableCommercialLocations (App02)
```prisma
model TableCommercialLocations {
  idCommercialLocation  Int       @id @default(autoincrement())
  idBusiness            Int?
  addressStreetNum      String?   @db.VarChar(100)
  addressZC             String?   @db.VarChar(10)
  addressTownCity       String?   @db.VarChar(100)
  addressState          String?   @db.VarChar(100)
  locationWhatsapp      String?   @db.VarChar(15)
  createdAt             DateTime? @default(now())
}
```

### TableOperatingHours (App02)
```prisma
model TableOperatingHours {
  idOperatingHours      Int       @id @default(autoincrement())
  idCommercialLocation  Int?
  weekDayNum            Int?
  openingTime           DateTime? @db.Time(0)
  closedTime            DateTime? @db.Time(0)
  haveTimeOff           Boolean?
}
```

### TableDaysOff (App02)
```prisma
model TableDaysOff {
  idDayOff             Int       @id @default(autoincrement())
  idCommercialLocation Int?
  uniqueDayOff         Boolean?  @default(true)
  startDayOff          DateTime? @db.Date
  endDayOff            DateTime? @db.Date
  notesDayOff          String?   @db.VarChar(500)
}
```

### TableServices (App02)
```prisma
model TableServices {
  idService            Int       @id @default(autoincrement())
  idBusiness           Int?
  serviceName          String?   @db.VarChar(100)
  descriptionService   String?   @db.VarChar(500)
  costServiceFinal     Decimal?  @db.Decimal(12, 2)
  durationMinutes      Decimal?  @db.Decimal(5, 2)
  createdAt            DateTime? @default(now())
}
```

### TableAppointments (App01 - Nota: esta tabla está en App01 pero usa IDs de App02)
```prisma
model TableAppointments {
  idAppointments       String                   @id @db.VarChar(36)
  idUser               String?                  @db.Char(36)
  idBusiness           Int?
  idCommercialLocation Int?
  idService            Int?
  startTimeDate        DateTime?                @db.DateTime(0)
  totalPriceBalance    Decimal                  @default(0.00) @db.Decimal(10, 2)
  bookingStatus        TableAppointments_status?
}
```

### TableTaxData (App02)
```prisma
model TableTaxData {
  idTaxData           Int       @id @default(autoincrement())
  idBusiness          Int?
  companyName         String?   @db.VarChar(100)
  rfc                 String?   @db.VarChar(15)
  billingEmail        String?   @db.VarChar(100)
  taxAddressStreetNum String?   @db.VarChar(100)
  taxDocumentKey      String?   @db.VarChar(255)
}
```

### TableLoyaltyPoints
```prisma
model TableLoyaltyPoints {
  id          String    @id @default(uuid())
  businessId  String
  clientId    String                              // FK lógico a Users.id en App01
  points      Int       @default(0)
}
```

### TableUserPlanBusiness (Roles internos)
```prisma
model TableUserPlanBusiness {
  id          String    @id @default(uuid())
  userId      String                              // FK lógico a Users.id en App01
  businessId  String                              // FK a TableBusiness.id
  role        Int                                 // 1=OWNER, 2=ADMIN, 3=STAFF
}
```

### Tablas de catálogo (seeds)
- `TableBusinessCategory` — Categorías de negocio (Belleza, Salud, etc.)
- `TableBusinessType` — Tipos de negocio (Salón, Spa, Barbería, etc.)
- `TableNNBusinessType` — Tabla N:N entre Business y BusinessType
- `TableTaxRegime` — Regímenes fiscales mexicanos
- `TableSubscriptionPlan` — Planes disponibles (FREE, STARTER, PRO)

## Relaciones clave (cross-table)

```
Users.id (App01) ──1:1──► TableBusiness.userId (App02)
Users.id (App01) ──1:N──► TableAppointments.clientId (App02)
Users.id (App01) ──1:N──► TableUserPlanBusiness.userId (App02)
Users.id (App01) ──1:N──► TableLoyaltyPoints.clientId (App02)

TableBusiness.id ──1:N──► TableCommercialLocations.businessId
TableBusiness.id ──1:N──► TableServices.businessId
TableBusiness.id ──1:N──► TableAppointments.businessId
TableBusiness.id ──1:1──► TableTaxData.businessId
TableBusiness.id ──1:N──► TableLoyaltyPoints.businessId
TableBusiness.id ──1:N──► TableUserPlanBusiness.businessId

TableCommercialLocations.id ──1:N──► TableOperatingHours.locationId
TableCommercialLocations.id ──1:N──► TableDaysOff.locationId
```

**NOTA:** Las relaciones cross-database (Users ↔ tablas de App02) son lógicas, no foreign keys reales. Prisma no soporta FKs entre bases de datos distintas. La integridad se mantiene por código.

## Reglas de queries

1. **Siempre filtrar por businessId:** Todo query en el dashboard DEBE incluir `where: { businessId }` tomado de la sesión del usuario. Nunca confiar en parámetros del cliente.

2. **No usar $transaction cross-database:**
```typescript
// ❌ INCORRECTO — esto no funciona
await prismaApp01.$transaction([...]);
await prismaApp02.$transaction([...]);

// ✅ CORRECTO — operaciones secuenciales
const user = await prismaApp01.users.create({ ... });
try {
  const business = await prismaApp02.tableBusiness.create({ data: { userId: user.id, ... } });
} catch (error) {
  // Rollback manual: eliminar el usuario creado
  await prismaApp01.users.delete({ where: { id: user.id } });
  throw error;
}
```

3. **Usar select, no devolver todo:**
```typescript
// ❌ Devuelve passwordHash y todo
const user = await prismaApp01.users.findUnique({ where: { id } });

// ✅ Solo lo que necesitas
const user = await prismaApp01.users.findUnique({
  where: { id },
  select: { id: true, email: true, role: true, phone: true }
});
```

## Migraciones

NO usamos `prisma migrate`. Las migraciones son scripts TypeScript manuales en `src/scripts/`:
```bash
npx tsx src/scripts/migrate-business-fields.ts
```

Cada script debe:
- Ser idempotente (verificar si ya se ejecutó antes de aplicar)
- Tener un log claro de lo que hizo
- NO eliminar datos existentes sin confirmación
