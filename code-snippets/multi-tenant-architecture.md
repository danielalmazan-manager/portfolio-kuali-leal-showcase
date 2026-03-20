# Multi-Tenant Architecture Pattern

## Overview

Kuali Leal implements a **dual-database multi-tenant architecture** that separates global user identity from isolated business data. This design provides the benefits of both shared and isolated tenancy models.

---

## Architecture Pattern

```typescript
/**
 * Database Connection Strategy
 *
 * Two separate MySQL databases managed by Prisma:
 * - App01: Global user identity and cross-platform transactions
 * - App02: Multi-tenant business configurations and operations
 */

// lib/prisma.ts
import { PrismaClient as PrismaClientApp01 } from '@/generated/app01';
import { PrismaClient as PrismaClientApp02 } from '@/generated/app02';

// Singleton pattern for database connections
const globalForPrisma = globalThis as unknown as {
  prismaApp01: PrismaClientApp01 | undefined;
  prismaApp02: PrismaClientApp02 | undefined;
};

/**
 * Database 01: Identity & Transactions
 *
 * Contains:
 * - users (universal accounts)
 * - TableAppointments (all bookings)
 * - TablePurchaseMovements (payment ledger)
 * - TableClientProfile (customer data)
 */
export const prismaApp01 =
  globalForPrisma.prismaApp01 ??
  new PrismaClientApp01({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_01,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

/**
 * Database 02: Multi-tenant Business Data
 *
 * Contains:
 * - TableBusiness (merchant profiles)
 * - TableServices (service catalogs)
 * - TableCommercialLocations (multi-location support)
 * - TableOperatingHours (scheduling)
 * - TableTaxData (Mexican tax compliance)
 * - TableSubscriptionCatalog (pricing tiers)
 */
export const prismaApp02 =
  globalForPrisma.prismaApp02 ??
  new PrismaClientApp02({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_02,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaApp01 = prismaApp01;
  globalForPrisma.prismaApp02 = prismaApp02;
}
```

---

## Prisma Schema Configuration

### Database 01 Schema (Identity)

```prisma
// prisma/schema_01.prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../src/generated/app01"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_01")
}

model users {
  idUser                 String                   @id @db.Char(36)
  phoneNumber            String                   @unique(map: "phone_number") @db.VarChar(20)
  nameUser               String?                  @db.VarChar(100)
  emailUser              String?                  @db.VarChar(100)
  passwordHash           String?                  @db.VarChar(255)
  role                   users_role               @default(CUSTOMER)
  statusActive           Boolean?                 @default(true)
  createdAt              DateTime?                @default(now()) @db.Timestamp(0)

  // Relations within same database
  TableAppointments      TableAppointments[]
  TablePurchaseMovements TablePurchaseMovements[]
  TableClientProfile     TableClientProfile[]
}

enum users_role {
  CUSTOMER
  BUSINESS_OWNER
  ADMIN
  STAFF
}

model TableAppointments {
  idAppointments         String                   @id @db.VarChar(36)
  idUser                 String?                  @db.Char(36)

  // Cross-database references (not enforced at DB level)
  idBusiness             Int?
  idCommercialLocation   Int?
  idService              Int?

  startTimeDate          DateTime?                @db.DateTime(0)
  totalPriceBalance      Decimal                  @default(0.00) @db.Decimal(10, 2)
  depositAmount          Decimal                  @default(0.00) @db.Decimal(10, 2)
  stripeIntentId         String?                  @db.VarChar(100)
  bookingStatus          TableAppointments_bookingStatus? @default(pending_payment)
  createdAt              DateTime?                @default(now()) @db.Timestamp(0)

  // Relations
  users                  users?                   @relation(fields: [idUser], references: [idUser])
  TablePurchaseMovements TablePurchaseMovements[]

  @@index([idBusiness], map: "fk_TableAppointments_to_TableBusiness")
  @@index([idService], map: "fk_TableAppointments_to_TableServices")
}

enum TableAppointments_bookingStatus {
  pending_payment
  confirmed
  partial_payment
  fully_paid
  completed
  cancelled
}
```

### Database 02 Schema (Multi-tenant)

```prisma
// prisma/schema_02.prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../src/generated/app02"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_02")
}

model TableBusiness {
  idBusiness                 Int                               @id @default(autoincrement())
  idUserOwner                String                            @db.Char(36) // Cross-DB reference to users
  businessName               String?                           @db.VarChar(255)
  businessDescription        String?                           @db.Text
  logoURL                    String?                           @db.VarChar(255)

  // Stripe Connect integration
  stripeAccountId            String?                           @db.VarChar(255)
  stripeCustomerId           String?                           @db.VarChar(255)
  payoutsEnabled             Boolean?
  chargesEnabled             Boolean?

  // Loyalty configuration
  pointsSchemeMultiplier     Decimal?                          @default(0.10) @db.Decimal(5, 2)

  // Subscription management
  currentPlan                TableBusiness_currentPlan?        @default(FREE)
  subscriptionStatus         TableBusiness_subscriptionStatus? @default(incomplete)
  subscriptionId             String?                           @db.VarChar(100)
  currentPeriodEnd           DateTime?                         @db.DateTime(0)

  statusActive               Boolean?                          @default(true)
  createdAt                  DateTime?                         @default(now()) @db.Timestamp(0)

  // Relations within same database
  TableServices              TableServices[]
  TableCommercialLocations   TableCommercialLocations[]
  TableBusinessSubscriptions TableBusinessSubscriptions[]

  @@index([idUserOwner], map: "fk_TableBusiness_to_users")
}

enum TableBusiness_currentPlan {
  FREE
  STARTER
  PRO
}

model TableServices {
  idService                  Int                             @id @default(autoincrement())
  idBusiness                 Int?
  serviceName                String?                         @db.VarChar(100)
  descriptionService         String?                         @db.VarChar(500)
  costServiceOrigin          Decimal?                        @db.Decimal(12, 2)
  costServiceFinal           Decimal?                        @db.Decimal(12, 2)
  depositPercentage          TableServices_depositPercentage @default(v30)
  durationMinutes            Decimal?                        @db.Decimal(5, 2)
  createdAt                  DateTime?                       @default(now()) @db.Timestamp(0)

  // Relations
  TableBusiness              TableBusiness?                  @relation(fields: [idBusiness], references: [idBusiness])
  TableGalleryService        TableGalleryService[]

  @@index([idBusiness], map: "idBusiness")
}

enum TableServices_depositPercentage {
  v10  @map("10")
  v30  @map("30")
  v50  @map("50")
  v100 @map("100")
}
```

---

## Environment Configuration

```bash
# .env file
# Database 01: Identity & Transactions
DATABASE_URL_01="mysql://username:password@localhost:3306/bdKualiLealApp01"

# Database 02: Multi-tenant Business Data
DATABASE_URL_02="mysql://username:password@localhost:3306/bdKualiLealApp02"

# Authentication
JWT_SECRET="your-secure-jwt-secret-min-32-chars"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

---

## Cross-Database Query Patterns

### Pattern 1: Sequential Queries

```typescript
/**
 * Fetch appointment with enriched business data
 *
 * Steps:
 * 1. Query Database 01 for appointment
 * 2. Extract cross-DB reference (idBusiness)
 * 3. Query Database 02 for business details
 */
export async function fetchAppointmentDetails(appointmentId: string) {
  // Step 1: Fetch from DB01
  const appointment = await prismaApp01.tableAppointments.findUnique({
    where: { idAppointments: appointmentId },
    include: {
      users: {
        select: { nameUser: true, emailUser: true }
      }
    }
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Step 2 & 3: Fetch related data from DB02
  const [business, service] = await Promise.all([
    prismaApp02.tableBusiness.findUnique({
      where: { idBusiness: appointment.idBusiness! },
      select: { businessName: true, logoURL: true }
    }),
    prismaApp02.tableServices.findUnique({
      where: { idService: appointment.idService! },
      select: { serviceName: true, costServiceFinal: true }
    })
  ]);

  // Combine data
  return {
    appointment: {
      id: appointment.idAppointments,
      datetime: appointment.startTimeDate,
      status: appointment.bookingStatus,
      customerName: appointment.users?.nameUser,
      customerEmail: appointment.users?.emailUser,
    },
    business: {
      name: business?.businessName,
      logo: business?.logoURL,
    },
    service: {
      name: service?.serviceName,
      price: service?.costServiceFinal,
    }
  };
}
```

### Pattern 2: Batch Queries (N+1 Prevention)

```typescript
/**
 * Fetch multiple appointments with business data
 *
 * Optimized approach:
 * 1. Fetch all appointments
 * 2. Collect unique business IDs
 * 3. Batch fetch businesses
 * 4. Map data efficiently
 */
export async function fetchUserAppointments(userId: string) {
  // Step 1: Fetch all user appointments from DB01
  const appointments = await prismaApp01.tableAppointments.findMany({
    where: { idUser: userId },
    orderBy: { startTimeDate: 'desc' }
  });

  // Step 2: Collect unique business and service IDs
  const businessIds = [...new Set(appointments.map(apt => apt.idBusiness!).filter(Boolean))];
  const serviceIds = [...new Set(appointments.map(apt => apt.idService!).filter(Boolean))];

  // Step 3: Batch fetch from DB02
  const [businesses, services] = await Promise.all([
    prismaApp02.tableBusiness.findMany({
      where: { idBusiness: { in: businessIds } },
      select: { idBusiness: true, businessName: true, logoURL: true }
    }),
    prismaApp02.tableServices.findMany({
      where: { idService: { in: serviceIds } },
      select: { idService: true, serviceName: true, costServiceFinal: true }
    })
  ]);

  // Step 4: Create lookup maps for O(1) access
  const businessMap = new Map(
    businesses.map(b => [b.idBusiness, b])
  );
  const serviceMap = new Map(
    services.map(s => [s.idService, s])
  );

  // Step 5: Enrich appointments with business data
  return appointments.map(apt => {
    const business = businessMap.get(apt.idBusiness!);
    const service = serviceMap.get(apt.idService!);

    return {
      id: apt.idAppointments,
      datetime: apt.startTimeDate,
      status: apt.bookingStatus,
      businessName: business?.businessName,
      businessLogo: business?.logoURL,
      serviceName: service?.serviceName,
      servicePrice: service?.costServiceFinal,
      depositAmount: apt.depositAmount,
    };
  });
}
```

### Pattern 3: Transaction-like Operations (Saga Pattern)

```typescript
/**
 * Create appointment with cross-database consistency
 *
 * Since MySQL doesn't support cross-database transactions,
 * we use a saga pattern with compensating transactions.
 */
export async function createAppointmentAction(data: AppointmentInput) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  let appointment: any = null;
  let paymentIntent: any = null;

  try {
    // Step 1: Validate business exists in DB02
    const service = await prismaApp02.tableServices.findUnique({
      where: { idService: data.serviceId },
      include: { TableBusiness: true }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    // Step 2: Create Stripe PaymentIntent (external service)
    const depositAmount = service.costServiceFinal! * (service.depositPercentage / 100);
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(depositAmount * 100),
      currency: 'mxn',
      transfer_data: {
        destination: service.TableBusiness.stripeAccountId!,
      },
    });

    // Step 3: Create appointment in DB01
    appointment = await prismaApp01.tableAppointments.create({
      data: {
        idAppointments: uuidv4(),
        idUser: session.userId,
        idBusiness: service.idBusiness,
        idService: service.idService,
        startTimeDate: data.datetime,
        totalPriceBalance: service.costServiceFinal,
        depositAmount: depositAmount,
        stripeIntentId: paymentIntent.id,
        bookingStatus: 'pending_payment',
      }
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      appointmentId: appointment.idAppointments,
    };

  } catch (error) {
    // Compensating transactions (rollback)
    console.error('[Appointment Creation Failed]:', error);

    // Cancel Stripe PaymentIntent if created
    if (paymentIntent) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelError) {
        console.error('[Stripe Cancel Failed]:', cancelError);
      }
    }

    // Delete appointment if created
    if (appointment) {
      try {
        await prismaApp01.tableAppointments.delete({
          where: { idAppointments: appointment.idAppointments }
        });
      } catch (deleteError) {
        console.error('[Appointment Delete Failed]:', deleteError);
      }
    }

    return { success: false, error: 'Failed to create appointment' };
  }
}
```

---

## Benefits of This Architecture

### 1. **Scalability**
- Each database can scale independently
- Customer data (DB01) scales with platform growth
- Business data (DB02) scales per tenant

### 2. **Security & Isolation**
- User credentials isolated from business data
- Easier compliance (GDPR, data portability)
- Tenant data logically separated

### 3. **Performance**
- Optimized indexes per database purpose
- Reduced query complexity (no tenant filtering on every query)
- Faster backups (can backup separately)

### 4. **Flexibility**
- Easy to add new business features without affecting user system
- Can migrate to microservices architecture later
- Different caching strategies per database

### 5. **Data Integrity**
- User identity remains consistent across platform
- Customer accounts work with multiple businesses
- Simplified user management

---

## Tradeoffs & Considerations

### ❌ Disadvantages

1. **No ACID Transactions Across Databases**
   - Must implement saga pattern for consistency
   - Requires compensating transactions on failure

2. **Increased Query Complexity**
   - Cannot use SQL JOINs across databases
   - Must perform multiple queries and merge in application

3. **Schema Management**
   - Two separate Prisma schemas to maintain
   - Must coordinate migrations carefully

4. **Referential Integrity**
   - Cross-DB foreign keys not enforced at database level
   - Must validate in application code

### ✅ Mitigation Strategies

1. **Application-Level Validation**
   ```typescript
   // Always validate cross-DB references
   const businessExists = await prismaApp02.tableBusiness.findUnique({
     where: { idBusiness: data.idBusiness }
   });
   if (!businessExists) throw new Error('Invalid business');
   ```

2. **Idempotency & Retry Logic**
   ```typescript
   // Use unique IDs for idempotency
   const appointmentId = uuidv4();
   // If retry occurs, duplicate check will catch it
   ```

3. **Webhook Reconciliation**
   - Stripe webhooks ensure eventual consistency
   - Payment status synced asynchronously

4. **Background Jobs for Data Consistency**
   - Periodic validation of cross-DB references
   - Cleanup orphaned records

---

## Migration Path (Future)

If needed to consolidate or migrate:

1. **Option A: Single Database**
   - Merge schemas into one database
   - Add `tenantId` column for isolation
   - Simplifies transactions but loses scaling benefits

2. **Option B: Microservices**
   - Extract into separate services:
     - Identity Service (DB01)
     - Business Service (DB02)
     - Payment Service (new)
   - API Gateway for communication
   - Event-driven architecture for consistency

---

**This architecture pattern demonstrates maturity in system design by balancing complexity, scalability, and maintainability.**
