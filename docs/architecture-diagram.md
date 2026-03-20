# System Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Customer Portal │  │  Business Dashboard│  │  Admin Panel     │         │
│  │  (kualileal.com) │  │  (app.kualileal) │  │                  │         │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤         │
│  │ • Browse Services│  │ • Analytics      │  │ • User Management│         │
│  │ • Book Appts     │  │ • Service Config │  │ • Platform Stats │         │
│  │ • Loyalty Points │  │ • Schedule Mgmt  │  │ • Fee Configuration│        │
│  │ • Payment        │  │ • Customer CRM   │  │                  │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                              │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ HTTPS (Next.js App Router)
                                   │
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                          APPLICATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Next.js 16 Application Server                    │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │                                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐         │    │
│  │  │   Middleware │  │ Server Actions│ │ React Server    │         │    │
│  │  │   (Auth)     │  │  (API Layer) │  │  Components     │         │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘         │    │
│  │                                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────┐     │    │
│  │  │             Business Logic Layer                          │     │    │
│  │  ├──────────────────────────────────────────────────────────┤     │    │
│  │  │  • Authentication Service   • Payment Processing         │     │    │
│  │  │  • Booking Engine           • Loyalty Calculator         │     │    │
│  │  │  • Availability Checker     • Notification System        │     │    │
│  │  └──────────────────────────────────────────────────────────┘     │    │
│  │                                                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└────────┬─────────────────────────┬──────────────────────────┬───────────────┘
         │                         │                          │
         │ Prisma ORM              │ Prisma ORM               │ Stripe SDK
         │                         │                          │
┌────────▼────────┐   ┌────────────▼────────────┐   ┌────────▼─────────┐
│                 │   │                          │   │                  │
│  Database 01    │   │     Database 02          │   │   Stripe API     │
│  (Identity)     │   │  (Multi-tenant Business) │   │                  │
│                 │   │                          │   │                  │
├─────────────────┤   ├──────────────────────────┤   ├──────────────────┤
│ MySQL 8.0       │   │ MySQL 8.0                │   │ • Payments       │
│                 │   │                          │   │ • Connect        │
│ • users         │   │ • TableBusiness          │   │ • Subscriptions  │
│ • TableAppts    │   │ • TableServices          │   │ • Webhooks       │
│ • TablePurchases│   │ • TableLocations         │   │                  │
│ • TableClient   │   │ • TableOperatingHours    │   │                  │
│   Profile       │   │ • TableGallery           │   │                  │
│                 │   │ • TableTaxData           │   │                  │
│                 │   │ • TableSubscriptions     │   │                  │
│                 │   │                          │   │                  │
└─────────────────┘   └──────────────────────────┘   └──────────────────┘
```

## Infrastructure & Deployment

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Production Server (Linux)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                     NGINX Reverse Proxy                   │      │
│  ├──────────────────────────────────────────────────────────┤      │
│  │  • SSL/TLS Termination (Let's Encrypt)                   │      │
│  │  • Load Balancing (Future)                               │      │
│  │  • Static Asset Serving                                  │      │
│  │  • Compression (gzip/brotli)                             │      │
│  └────────────┬─────────────────────────────────────────────┘      │
│               │                                                      │
│  ┌────────────▼─────────────────────────────────────────────┐      │
│  │              PM2 Process Manager                          │      │
│  ├──────────────────────────────────────────────────────────┤      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │      │
│  │  │ Next.js App │  │ Next.js App │  │ Next.js App │     │      │
│  │  │ Instance 1  │  │ Instance 2  │  │ Instance 3  │     │      │
│  │  │  (Port 3000)│  │  (Port 3001)│  │  (Port 3002)│     │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │      │
│  │                                                           │      │
│  │  • Cluster Mode (Multi-core utilization)                │      │
│  │  • Auto-restart on failure                              │      │
│  │  • Log aggregation                                      │      │
│  └───────────────────────────────────────────────────────────      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                   MySQL 8.0 Server                        │      │
│  ├──────────────────────────────────────────────────────────┤      │
│  │  • InnoDB Engine                                         │      │
│  │  • Connection Pooling                                    │      │
│  │  • Automated Backups (Daily)                             │      │
│  │  • Binary Logging (Replication ready)                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Appointment Booking

```
┌─────────────┐
│   Customer  │
└──────┬──────┘
       │ 1. Browse services
       │
┌──────▼─────────────────────────────────────────────────────┐
│  Next.js Server (React Server Component)                   │
│  • Query Database 02: TableServices, TableLocations        │
│  • Check availability (TableOperatingHours, TableDaysOff)  │
└──────┬─────────────────────────────────────────────────────┘
       │ 2. Display available time slots
       │
┌──────▼──────┐
│   Customer  │ 3. Select time + Submit booking
└──────┬──────┘
       │
┌──────▼─────────────────────────────────────────────────────┐
│  Server Action: createAppointmentAction()                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 1: Validate session (JWT decrypt)             │   │
│  │ Step 2: Check availability (race condition lock)   │   │
│  │ Step 3: Calculate deposit (service percentage)     │   │
│  │ Step 4: Create Stripe PaymentIntent                │   │
│  │ Step 5: Insert into Database 01: TableAppointments │   │
│  │         (status: pending_payment)                   │   │
│  │ Step 6: Return client_secret for payment           │   │
│  └─────────────────────────────────────────────────────┘   │
└──────┬─────────────────────────────────────────────────────┘
       │ 4. Client secret returned
       │
┌──────▼──────────┐
│  Stripe.js SDK  │ 5. Customer enters card details
└──────┬──────────┘
       │
┌──────▼──────────┐
│  Stripe API     │ 6. Process payment
└──────┬──────────┘
       │ 7. Webhook: payment_intent.succeeded
       │
┌──────▼─────────────────────────────────────────────────────┐
│  Webhook Handler: /api/webhooks/stripe                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 1: Verify signature                           │   │
│  │ Step 2: Update TableAppointments                   │   │
│  │         (status: confirmed)                         │   │
│  │ Step 3: Insert TablePurchaseMovements              │   │
│  │         (paymentType: deposit)                      │   │
│  │ Step 4: Calculate platform fee + merchant net      │   │
│  │ Step 5: Send confirmation email                    │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Network Security                                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │ • HTTPS Only (TLS 1.3)                          │       │
│  │ • HSTS Headers                                  │       │
│  │ • Rate Limiting (NGINX)                         │       │
│  │ • DDoS Protection                               │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Layer 2: Authentication                                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │ • JWT with HS256 encryption                     │       │
│  │ • HttpOnly cookies (XSS prevention)             │       │
│  │ • 7-day expiration with auto-refresh            │       │
│  │ • bcrypt password hashing (10 rounds)           │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Layer 3: Authorization                                     │
│  ┌──────────────────────────────────────────────────┐       │
│  │ • Role-based access control (RBAC)              │       │
│  │ • Server-side permission checks                 │       │
│  │ • Tenant isolation (multi-tenancy)              │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Layer 4: Data Security                                     │
│  ┌──────────────────────────────────────────────────┐       │
│  │ • Prisma prepared statements (SQL injection)    │       │
│  │ • Input validation (Zod schemas)                │       │
│  │ • Sanitization of user inputs                   │       │
│  │ • Environment variable isolation                │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Layer 5: Payment Security                                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │ • PCI-DSS compliant (via Stripe)                │       │
│  │ • Webhook signature verification                │       │
│  │ • Idempotency keys                              │       │
│  │ • No card data storage                          │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Scaling Strategy (Future)

```
Current: Single-server monolith
Future: Horizontal scaling

┌─────────────────────────────────────────────────────────────┐
│                  Load Balancer (NGINX)                       │
└────┬────────────┬────────────┬────────────┬─────────────────┘
     │            │            │            │
┌────▼───┐   ┌───▼────┐  ┌────▼───┐  ┌────▼───┐
│ App 01 │   │ App 02 │  │ App 03 │  │ App 04 │
└────┬───┘   └───┬────┘  └────┬───┘  └────┬───┘
     │           │            │           │
     └───────────┴────────────┴───────────┘
                 │
         ┌───────▼──────┐
         │  Redis Cache │
         │  (Sessions)  │
         └───────┬──────┘
                 │
     ┌───────────┴───────────┐
     │                       │
┌────▼────────┐   ┌──────────▼────┐
│  MySQL      │   │  MySQL         │
│  Primary    │   │  Read Replica  │
│  (Write)    │   │  (Read)        │
└─────────────┘   └────────────────┘
```

---

## Technology Choices & Rationale

### Why Next.js 16?
- **Server Components**: Reduced JavaScript bundle by 60%
- **App Router**: File-based routing with layouts
- **Server Actions**: Type-safe API without REST boilerplate
- **Streaming**: Improved perceived performance
- **Edge-ready**: Future CDN deployment path

### Why Multi-Database Architecture?
- **Security**: User data isolated from business configurations
- **Scalability**: Independent scaling per concern
- **Compliance**: Simplified GDPR/data portability
- **Performance**: Optimized indexes per database purpose
- **Microservices Ready**: Clear separation for future decomposition

### Why MySQL over PostgreSQL?
- **Hosting simplicity**: Available on all shared hosting
- **Performance**: InnoDB excellent for transactional workloads
- **Tooling maturity**: Familiar ecosystem for SMB market
- **Cost**: Lower hosting costs for MVP phase

### Why Prisma ORM?
- **Type Safety**: Auto-generated TypeScript types
- **Developer Experience**: Intuitive schema definition
- **Migration System**: Robust version control for schema
- **Multi-Schema Support**: Perfect for our 2-database architecture

---

**Note**: This architecture document represents the production system as of March 2026. Contact me for detailed walkthroughs of any component.
