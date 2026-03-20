# Database Entity-Relationship Diagrams (ERD)

## Overview

Kuali Leal implements a **dual-database architecture** for strategic separation of concerns:

- **Database 01**: Global user identity, authentication, and cross-platform transactions
- **Database 02**: Business configurations, services, multi-tenant operational data

---

## Database 01: Identity & Transactions

### Purpose
Centralized user management and payment tracking across all businesses on the platform.

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Database 01 (bdKualiLealApp01)                   │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   EnumAuthProvider   │
├──────────────────────┤
│ PK idAuthProvider    │
│    valueAP           │  (e.g., "email", "google", "facebook")
│    veryfieldAP       │
│    hashVeryfieldAP   │
│    statusActive      │
└──────────┬───────────┘
           │
           │ 1:N
           │
┌──────────▼─────────────────────┐
│         users                  │
├────────────────────────────────┤
│ PK idUser (UUID)               │
│    phoneNumber (UNIQUE)        │
│    nameUser                    │
│    lastName                    │
│    emailUser                   │
│    passwordHash (bcrypt)       │
│    emailVerified               │
│    verificationCode            │
│    role (ENUM)                 │  ← CUSTOMER | BUSINESS_OWNER | ADMIN | STAFF
│    statusActive                │
│ FK idAuthProvider              │
│    createdAt                   │
└────────┬──────────┬────────────┘
         │          │
         │ 1:N      │ 1:N
         │          │
         │          │
         │    ┌─────▼──────────────────────────┐
         │    │  TableClientProfile            │
         │    ├────────────────────────────────┤
         │    │ PK idClientProfile             │
         │    │ FK idUser                      │
         │    │    customerPreferences (JSON)  │  ← Stores custom preferences
         │    │    hashVeryfieldTermConditions │
         │    │    urlPhoto                    │
         │    │    createdAt                   │
         │    └────────────────────────────────┘
         │
         │ 1:N
         │
┌────────▼──────────────────────────────────┐
│      TableAppointments                    │
├───────────────────────────────────────────┤
│ PK idAppointments (UUID)                  │
│ FK idUser                                 │
│ FK idStatusAppointments                   │
│    idBusiness (→ DB02)                    │  ← Cross-database reference
│    idCommercialLocation (→ DB02)          │  ← Cross-database reference
│    idService (→ DB02)                     │  ← Cross-database reference
│    startTimeDate                          │
│    totalPriceBalance                      │
│    depositAmount                          │
│    stripeIntentId                         │
│    bookingStatus (ENUM)                   │  ← pending_payment | confirmed | partial_payment
│                                           │     fully_paid | completed | cancelled
│    createdAt                              │
└────────┬──────────────────────────────────┘
         │
         │ 1:N
         │
┌────────▼──────────────────────────────────┐
│    TablePurchaseMovements                 │  ← Transaction Ledger
├───────────────────────────────────────────┤
│ PK idPurchaseMovements                    │
│ FK idUser                                 │
│ FK idAppointments                         │
│ FK idPaymentType                          │
│ FK idPaymentMethod                        │
│ FK idPaymentStatus                        │
│    amountDeposited                        │
│    kualiFee (Platform commission)         │
│    entrepreneurNet (Merchant payout)      │
│    paymentType (ENUM)                     │  ← deposit | balance | extra
│    status (ENUM)                          │  ← pending | succeeded | failed | refunded
│    stripeIntentId                         │
│    createdAt                              │
└───────────────────────────────────────────┘

┌──────────────────────────┐
│  EnumStatusAppointments  │
├──────────────────────────┤
│ PK idStatusAppointments  │
│    nameStatusAppointments│
└──────────────────────────┘

┌──────────────────────────┐
│   EnumPaymentType        │
├──────────────────────────┤
│ PK idPaymentType         │
│    namePaymentType       │
└──────────────────────────┘

┌──────────────────────────┐
│   EnumPaymentMethod      │
├──────────────────────────┤
│ PK idPaymentMethod       │
│    namePaymentMethod     │
└──────────────────────────┘

┌──────────────────────────┐
│   EnumPaymentStatus      │
├──────────────────────────┤
│ PK idPaymentStatus       │
│    namePaymentStatus     │
└──────────────────────────┘
```

### Key Relationships

#### users → TableAppointments (1:N)
- A customer can have multiple bookings across different businesses
- Business owners can also be customers

#### TableAppointments → TablePurchaseMovements (1:N)
- Each appointment can have multiple payment transactions:
  - **deposit**: Initial booking payment (e.g., 30% of service price)
  - **balance**: Final payment on service completion
  - **extra**: Tips, add-ons, or modifications

#### TablePurchaseMovements: Platform Fee Calculation
```typescript
// Automatic fee calculation logic
kualiFee = amountDeposited * platformFeePercentage // e.g., 10%
entrepreneurNet = amountDeposited - kualiFee
```

---

## Database 02: Business Multi-tenancy

### Purpose
Isolated business configurations, service catalogs, locations, and operational data.

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Database 02 (bdKualiLealApp02)                      │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌────────────────────────┐
                              │   TableBusiness        │  ← Core Business Entity
                              ├────────────────────────┤
                              │ PK idBusiness          │
                              │    idUserOwner (→ DB01)│  ← Foreign key to users table
                              │    businessName        │
                              │    businessDescription │
                              │    logoURL             │
                              │    webURL, socialURLs  │
                              │                        │
                              │ ─── Stripe Connect ─── │
                              │    stripeAccountId     │
                              │    stripeCustomerId    │
                              │    payoutsEnabled      │
                              │    chargesEnabled      │
                              │    tosAcceptanceDate   │
                              │                        │
                              │ ─── Loyalty Config ─── │
                              │    pointsSchemeMultiplier │  ← 0.10 = 10% cashback
                              │                        │
                              │ ─── Subscription ──── │
                              │    currentPlan (ENUM)  │  ← FREE | STARTER | PRO
                              │    subscriptionStatus  │
                              │    subscriptionId      │
                              │    currentPeriodEnd    │
                              │                        │
                              │    statusActive        │
                              │    createdAt           │
                              └──┬──────┬─────┬────┬───┘
                                 │      │     │    │
            ┌────────────────────┘      │     │    └────────────────┐
            │                           │     │                     │
            │ 1:N                       │ 1:N │ 1:N                 │ 1:N
            │                           │     │                     │
┌───────────▼──────────────┐  ┌─────────▼─────┴─────────┐  ┌───────▼────────────────┐
│  TableNNBusinessType     │  │  TableCommercialLocations│  │  TableServices         │
│  (Many-to-Many)          │  ├──────────────────────────┤  ├────────────────────────┤
├──────────────────────────┤  │ PK idCommercialLocation  │  │ PK idService           │
│ PK idNNBusinessType      │  │ FK idBusiness            │  │ FK idBusiness          │
│ FK idBusiness            │  │ FK idServiceType         │  │ FK idBusinessType      │
│ FK idBusinessType        │  │ FK idStatusCommercial... │  │ FK idStatusService     │
│    createdAt             │  │                          │  │    serviceName         │
└──────────────────────────┘  │ ── Location Type ──      │  │    descriptionService  │
                               │    isTemporary           │  │                        │
┌──────────────────────────┐  │    validFromDate         │  │ ── Pricing ──          │
│   EnumBusinessCategory   │  │    validUntilDate        │  │    costServiceOrigin   │
├──────────────────────────┤  │                          │  │    discountApplies     │
│ PK idCategoryBusiness    │  │ ── Address ──            │  │    porcentageDiscount  │
│    nameCategoryBusiness  │  │    addressStreetNum      │  │    costServiceFinal    │
│    statusActive          │  │    addressZC             │  │                        │
└──────────┬───────────────┘  │    addressTownCity       │  │ ── Deposit ──          │
           │                  │    addressState          │  │    depositPercentage   │  ← 10 | 30 | 50 | 100
           │ 1:N              │    addressLatitude       │  │                        │
┌──────────▼───────────────┐  │    addressLongitude      │  │ ── Scheduling ──       │
│   EnumBusinessType       │  │                          │  │    durationMinutes     │
├──────────────────────────┤  │ ── Coverage ──           │  │    beforeTimeInterval  │
│ PK idBusinessType        │  │    coverageRadiusKM      │  │    afterTimeInterval   │
│ FK idCategoryBusiness    │  │                          │  │                        │
│    subcategoryName       │  │ ── Contact ──            │  │    createdAt           │
│    statusActive          │  │    defaultWhatsapp       │  └────────┬───────────────┘
│    createdAt             │  │    locationWhatsapp      │           │
└──────────────────────────┘  │                          │           │ 1:N
                               │    createdAt             │           │
                               └──┬─────┬────────┬────────┘  ┌────────▼───────────────┐
                                  │     │        │           │ TableGalleryService    │
                                  │ 1:N │ 1:N    │ 1:N       ├────────────────────────┤
                                  │     │        │           │ PK idGalleryService    │
                     ┌────────────┘     │        └─────┐     │ FK idService           │
                     │                  │              │     │    imageURL            │
      ┌──────────────▼────────┐  ┌──────▼──────────┐  │     │    isPrimaryImage      │
      │ TableOperatingHours   │  │ TableGalleryLoc │  │     │    createdAt           │
      ├───────────────────────┤  ├─────────────────┤  │     └────────────────────────┘
      │ PK idOperatingHours   │  │ PK idGalleryLoc │  │
      │ FK idCommercialLoc... │  │ FK idCommercial │  │
      │    weekDayNum (0-6)   │  │    imageURL     │  │     ┌──────────────────────────┐
      │    openingTime        │  │    createdAt    │  │     │ TableRelLocationService  │
      │    closedTime         │  └─────────────────┘  │     │ (Many-to-Many)           │
      │    haveTimeOff        │                       │     ├──────────────────────────┤
      │    createdAt          │                       └────▶│ PK idRelLocationService  │
      └───────┬───────────────┘                             │ FK idService             │
              │                                             │ FK idCommercialLocation  │
              │ 1:N                                         └──────────────────────────┘
              │
      ┌───────▼───────────────┐
      │   TableTimeOff        │  ← Break times within operating hours
      ├───────────────────────┤
      │ PK idTimeOff          │
      │ FK idOperatingHours   │
      │    startTimeOff       │
      │    endTimeOff         │
      │    activeTimeOff      │
      │    createdAt          │
      └───────────────────────┘

      ┌───────────────────────┐
      │   TableDaysOff        │  ← Holidays, vacations
      ├───────────────────────┤
      │ PK idDayOff           │
      │ FK idCommercialLoc... │
      │    parcialDayOff      │
      │    startHourOff       │
      │    endHourOff         │
      │    uniqueDayOff       │
      │    startDayOff        │
      │    endDayOff          │
      │    notesDayOff        │
      │    activeTimeOff      │
      │    createdAt          │
      └───────────────────────┘
```

### Subscription & Billing Schema

```
┌──────────────────────────────────┐
│  TableSubscriptionCatalog        │  ← Platform pricing tiers
├──────────────────────────────────┤
│ PK idPlanSelect                  │
│    namePlan                      │  (e.g., "FREE", "STARTER", "PRO")
│    monthlyPrice                  │
│    locationLimit                 │
│    clientLimit                   │
│    storageLimit                  │
│    customerWhatsapp              │
│    userAdminLimit                │
│    userContributingLimit         │
│    userEmployeeLimit             │
│    statusActive                  │
└────────┬─────────────────────────┘
         │
         │ 1:N
         │
┌────────▼─────────────────────────────────┐
│  TableBusinessSubscriptions              │
├──────────────────────────────────────────┤
│ PK idBusinessSubscription                │
│ FK idPlanSelect                          │
│ FK idBusiness                            │
│ FK idStatusBusinessSubscriptions         │
│    startDate                             │
│    renewalDate                           │
│    stripeCustomerId                      │
│    stripeSuscriptionId                   │
│    createdAt                             │
└────────┬─────────────────────────────────┘
         │
         │ 1:N
         │
┌────────▼─────────────────────────────────┐
│  TableUserPlanBusiness                   │  ← Team members access control
├──────────────────────────────────────────┤
│ PK idUserPlanBusiness                    │
│    idUser (→ DB01)                       │  ← Cross-database reference
│ FK idRolBusiness                         │
│ FK idBusinessSubscription                │
│ FK idBusiness                            │
│    veryfieldBusiness                     │
│    createdAt                             │
└──────────────────────────────────────────┘

┌──────────────────────────────┐
│  EnumUserRolBusiness         │
├──────────────────────────────┤
│ PK idRolBusiness             │
│    valueRB                   │  (e.g., "OWNER", "ADMIN", "EMPLOYEE")
└──────────────────────────────┘

┌──────────────────────────────────┐
│  EnumStatusBusinessSubscriptions │
├──────────────────────────────────┤
│ PK idStatusBusinessSubscriptions │
│    valueSBS                      │  (e.g., "active", "past_due", "canceled")
└──────────────────────────────────┘
```

### Mexican Tax Compliance Schema

```
┌─────────────────────────────┐
│    CatalogTaxRegime         │  ← SAT Catalog (Régimen Fiscal)
├─────────────────────────────┤
│ PK idTaxRegime              │
│    claveTax                 │  (e.g., "601", "612")
│    descriptionTax           │
│    personNatural            │
│    legalEntity              │
│    statusActive             │
└──────────┬──────────────────┘
           │
           │ M:N
           │
┌──────────▼──────────────────────────┐
│  TableRelationTaxRegimenCDFI        │  ← Valid combinations
├─────────────────────────────────────┤
│ PK idRTRCFDI                        │
│ FK idTaxRegime                      │
│ FK idCFDI                           │
└─────────┬───────────────────────────┘
          │
          │
┌─────────▼──────────┐       ┌────────────────────────┐
│   CatalogCFDI      │       │   TableTaxData         │  ← Business tax info
├────────────────────┤       ├────────────────────────┤
│ PK idCFDI          │       │ PK idTaxData           │
│    claveCFDI       │       │ FK idBusiness          │
│    descriptionCFDI │       │ FK idTaxRegime         │
│    personNatural   │       │ FK idRTRCFDI           │
│    legalEntity     │       │    isPersonNaturalLE   │
│    statusActive    │       │    companyName         │
└────────────────────┘       │    personName          │
                              │    rfc (Tax ID)        │
                              │    taxAddressStreetNum │
                              │    taxAddressZC        │
                              │    taxAddressTownCity  │
                              │    taxAddressState     │
                              │    billingEmail        │
                              │    createdAt           │
                              └────────┬───────────────┘
                                       │
                                       │ 1:N
                                       │
                              ┌────────▼─────────────────────┐
                              │  TableBankingInformation     │
                              ├──────────────────────────────┤
                              │ PK idBankingInformation      │
                              │ FK idTaxData                 │
                              │    idBusinessType            │
                              │    bankingName               │
                              │    interbankCLABE (18 digits)│
                              │    defaultAccount            │
                              │    createdAt                 │
                              └──────────────────────────────┘
```

---

## Cross-Database Relationships

### Logical Foreign Keys (Not Enforced at DB Level)

Since MySQL does not support cross-database foreign key constraints, these relationships are enforced at the **application level** via Prisma:

```typescript
// Example: Appointment references across databases

// Database 01: TableAppointments
{
  idAppointments: "uuid-123",
  idUser: "user-uuid-456",        // ✅ FK enforced (same DB)
  idBusiness: 42,                 // ⚠️ Logical FK to DB02.TableBusiness
  idCommercialLocation: 7,        // ⚠️ Logical FK to DB02.TableCommercialLocations
  idService: 15,                  // ⚠️ Logical FK to DB02.TableServices
}
```

**Application-Level Validation**:
```typescript
// Before creating appointment, validate references exist
const business = await prismaApp02.tableBusiness.findUnique({
  where: { idBusiness: data.idBusiness }
});
if (!business) throw new Error("Invalid business");
```

---

## Key Design Patterns

### 1. Enum Pattern
Most status/type fields are normalized into separate enum tables:
- `EnumAuthProvider`, `EnumPaymentType`, `EnumStatusService`, etc.
- **Benefit**: Referential integrity, easy updates without schema changes

### 2. Multi-Tenant Isolation
- Each business is a "tenant" with isolated data in Database 02
- Customer data (Database 01) is shared across tenants
- **Benefit**: Single customer account works across all businesses

### 3. Flexible Scheduling
- `TableOperatingHours`: Weekly schedule per location
- `TableTimeOff`: Break times within a day (e.g., lunch 1-2 PM)
- `TableDaysOff`: Holidays, vacations, temporary closures
- **Benefit**: Supports complex real-world schedules

### 4. Payment Reconciliation
- `stripeIntentId` stored in both `TableAppointments` and `TablePurchaseMovements`
- Webhook reconciliation ensures data consistency
- **Benefit**: Automatic fee calculation and merchant payout tracking

### 5. Decimal Time Representation
```sql
-- Operating hours stored as DECIMAL(5,2) for precise calculations
openingTime = 09.00  -- 9:00 AM
closedTime = 17.30   -- 5:30 PM
```
**Benefit**: Avoids floating-point precision issues in availability algorithms

---

## Indexes & Performance

### Critical Indexes (Database 01)
```sql
-- Fast user lookup
CREATE INDEX idx_users_email ON users(emailUser);
CREATE INDEX idx_users_phone ON users(phoneNumber);

-- Appointment queries
CREATE INDEX idx_appointments_user ON TableAppointments(idUser);
CREATE INDEX idx_appointments_business ON TableAppointments(idBusiness);
CREATE INDEX idx_appointments_date ON TableAppointments(startTimeDate);

-- Payment ledger queries
CREATE INDEX idx_purchases_user ON TablePurchaseMovements(idUser);
CREATE INDEX idx_purchases_stripe ON TablePurchaseMovements(stripeIntentId);
```

### Critical Indexes (Database 02)
```sql
-- Business lookups
CREATE INDEX idx_business_owner ON TableBusiness(idUserOwner);
CREATE INDEX idx_business_stripe ON TableBusiness(stripeAccountId);

-- Service catalog queries
CREATE INDEX idx_services_business ON TableServices(idBusiness);
CREATE INDEX idx_services_type ON TableServices(idBusinessType);

-- Location-based queries
CREATE INDEX idx_locations_business ON TableCommercialLocations(idBusiness);
CREATE INDEX idx_locations_status ON TableCommercialLocations(idStatusCommercialLocation);
```

---

## Future Considerations

### Scaling Strategies

1. **Read Replicas**: For analytics queries on payment history
2. **Sharding by Business ID**: If Database 02 grows beyond single-server capacity
3. **Caching Layer**: Redis for frequently accessed business configurations
4. **CQRS Pattern**: Separate read/write models for high-traffic businesses

### Data Archival

- Move completed appointments older than 2 years to cold storage
- Maintain payment ledger indefinitely for compliance

---

**Note**: This ERD represents the production schema as of March 2026. For schema evolution history and migration files, contact me directly.
