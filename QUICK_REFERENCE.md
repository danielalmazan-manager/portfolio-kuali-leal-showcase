# Kuali Leal - Quick Reference Card

> **One-page technical overview for rapid evaluation**

---

## 📊 Project at a Glance

| Aspect | Details |
|--------|---------|
| **Project Name** | Kuali Leal |
| **Type** | B2B SaaS - Loyalty & Rewards Platform |
| **Stage** | Production/Beta (Active commercial product) |
| **Team** | Solo founder project (Full ownership) |
| **Development Time** | 6 months |
| **Lines of Code** | ~15,000+ TypeScript/TSX |
| **Target Market** | SMBs (Beauty, Wellness, Automotive, Hospitality) |

---

## 🛠️ Tech Stack Summary

### Frontend
- **Framework**: Next.js 16 (React 19, App Router, RSC)
- **Language**: TypeScript 5.x (100% type-safe)
- **Styling**: Tailwind CSS 4 + Radix UI + shadcn/ui
- **State**: Server Components + Server Actions
- **Forms**: React Hook Form + Zod validation
- **Animation**: Framer Motion

### Backend
- **Runtime**: Node.js (Next.js Server Actions)
- **Database**: MySQL 8.0 (2 databases)
- **ORM**: Prisma 5.22 (multi-schema)
- **Auth**: JWT (jose) + bcrypt + HttpOnly cookies
- **Payments**: Stripe API (Connect + Subscriptions)

### Infrastructure
- **Hosting**: Self-hosted Linux (Debian)
- **Web Server**: NGINX (reverse proxy + SSL)
- **Process Manager**: PM2 (cluster mode)
- **SSL**: Let's Encrypt (auto-renewal)
- **Backups**: Automated daily MySQL dumps

---

## 🏗️ Architecture Highlights

### Multi-Database Design
```
Database 01 (Identity)     Database 02 (Multi-tenant)
├─ users                   ├─ TableBusiness
├─ TableAppointments       ├─ TableServices
├─ TablePurchaseMovements  ├─ TableCommercialLocations
└─ TableClientProfile      └─ TableSubscriptions
```

**Why?**
- Scalability: Independent scaling per concern
- Security: User data isolated from business configs
- Compliance: Simplified GDPR/data portability
- Performance: Optimized indexes per database purpose

### Key Design Patterns
- ✅ **Server Actions** instead of REST APIs (type-safe, no boilerplate)
- ✅ **Multi-tenant isolation** without tenant filtering overhead
- ✅ **Saga pattern** for cross-database transactions
- ✅ **Webhook reconciliation** for payment consistency
- ✅ **Role-based access control** (CUSTOMER, BUSINESS_OWNER, ADMIN, STAFF)

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| **Authentication** | JWT with HS256 encryption |
| **Session Storage** | HttpOnly cookies (XSS protection) |
| **Password Hashing** | bcrypt with 10 salt rounds |
| **SQL Injection** | Prisma prepared statements |
| **Input Validation** | Zod runtime validation |
| **Payment Security** | PCI-DSS compliant (via Stripe) |
| **HTTPS** | TLS 1.3 with HSTS headers |
| **CSRF Protection** | Built-in Server Actions |

---

## 💰 Stripe Integration

### Features Implemented
1. **Stripe Connect** (Marketplace payments)
   - Merchant onboarding
   - Split payments (platform fee + merchant payout)
   - Automatic commission calculation

2. **Payment Intents** (Appointment deposits)
   - Configurable deposit percentage (10-100%)
   - Balance payment on completion
   - Idempotency for retries

3. **Subscriptions** (SaaS billing)
   - FREE, STARTER, PRO tiers
   - Monthly recurring billing
   - Usage limit enforcement

---

## 📈 Business Logic Examples

### Appointment Deposit Calculation
```typescript
Service Price: $1,000 MXN
Deposit %: 30%
─────────────────────────
Customer pays: $300 MXN
Platform fee (10%): $30 MXN
Merchant receives: $270 MXN
Balance remaining: $700 MXN (paid on completion)
```

### Loyalty Points System
```typescript
Purchase: $500 MXN
Points multiplier: 0.10 (10%)
─────────────────────────
Points earned: 50 points = $50 MXN future credit
```

---

## 📊 Database Stats

| Metric | Count |
|--------|-------|
| **Total Tables** | 28 (across 2 databases) |
| **Enums/Lookups** | 12 tables |
| **Foreign Keys** | 40+ relationships |
| **Indexes** | 50+ optimized indexes |
| **Multi-DB References** | 5 logical FKs |

### Complex Tables
- `TableAppointments`: State machine (6 booking statuses)
- `TableOperatingHours`: Weekly schedule + breaks + time-off
- `TableServices`: Pricing + scheduling + deposit config
- `TablePurchaseMovements`: Payment ledger with fee splits

---

## 🚀 Performance Optimizations

- ✅ React Server Components (60% bundle size reduction)
- ✅ Automatic code splitting (route-based)
- ✅ Image optimization (WebP, AVIF)
- ✅ Database connection pooling
- ✅ Strategic indexes on hot query paths
- ✅ PM2 cluster mode (multi-core utilization)

---

## 📁 Repository Contents

| Directory | Purpose |
|-----------|---------|
| **docs/** | Architecture diagrams + ERD |
| **infrastructure/** | Docker + deployment configs |
| **api/** | Server Actions patterns + Stripe integration |
| **code-snippets/** | Production code samples |

### Key Files
- `README.md` - Comprehensive project overview ⭐
- `SETUP.md` - Navigation guide
- `docs/database-erd.md` - Complete database schema
- `code-snippets/auth-middleware.ts` - JWT implementation
- `code-snippets/server-actions-example.ts` - API patterns

---

## 🎯 Technical Achievements

1. **Multi-Database Architecture** with saga pattern for consistency
2. **Stripe Connect Integration** with automated fee calculation
3. **Type-Safe Full-Stack** (database → API → UI)
4. **Production Deployment** on self-hosted infrastructure
5. **Mexican Tax Compliance** (RFC, CFDI, tax regimes)
6. **Complex Scheduling Logic** (operating hours, time-off, vacations)
7. **Role-Based Access Control** across dual databases
8. **Webhook-Based Payment Reconciliation** for reliability

---

## 💼 Skills Demonstrated

### Technical Skills
- Full-stack development (Next.js, React, Node.js, MySQL)
- System architecture (multi-tenant, microservices-ready)
- Database design (normalization, indexing, optimization)
- API design (RESTful alternatives with Server Actions)
- Payment processing (Stripe Connect, PCI-DSS compliance)
- DevOps (Linux, NGINX, PM2, SSL, backups)
- Security (JWT, bcrypt, RBAC, input validation)

### Soft Skills
- **Product thinking**: Identified market need, built solution
- **Problem-solving**: Complex scheduling, cross-DB transactions
- **Independent work**: Solo project from concept to production
- **Documentation**: Technical writing, architecture diagrams
- **Business acumen**: SaaS pricing, platform economics

---

## 📞 Contact for Interviews

**Ready to dive deeper?** Let's schedule a technical interview where I can:
- 🖥️ Demo the live application
- 📂 Walk through the complete source code
- 🏗️ Discuss architectural decisions
- 🧪 Pair program or solve technical challenges
- 💬 Answer any questions in detail

**Contact**: [your.email@example.com]
**Calendar**: [Schedule Interview](https://calendly.com/yourlink)
**Response Time**: < 24 hours

---

## 🏆 Why This Project Stands Out

1. **Production-Ready**: Not a tutorial project - real commercial SaaS in use
2. **Complex Business Logic**: Real-world scheduling, payments, multi-tenancy
3. **Modern Stack**: Cutting-edge Next.js 16, React 19, TypeScript 5
4. **Full Ownership**: Designed, built, deployed, and maintained solo
5. **Business Value**: Solving real SMB problems with technology
6. **Scale-Ready**: Architecture supports horizontal scaling
7. **Security-First**: Multiple layers of protection implemented
8. **Well-Documented**: Professional documentation for maintainability

---

## 📝 Quick Stats

```
Databases:           2
Tables:              28
API Actions:         40+
UI Components:       60+
Development Time:    6 months
Test Coverage:       Critical payment flows
Security Audits:     Self-audited (production-ready)
Active Users:        Beta/production phase
```

---

## 🔗 Quick Links

- 📖 [Full README](./README.md)
- 🏗️ [Architecture Diagram](./docs/architecture-diagram.md)
- 🗄️ [Database ERD](./docs/database-erd.md)
- 🔐 [Auth Code](./code-snippets/auth-middleware.ts)
- 🎯 [API Patterns](./api/api-design-patterns.md)
- 💳 [Stripe Integration](./api/stripe-integration-overview.md)
- 🚀 [Deployment Notes](./infrastructure/deployment-notes.md)

---

**Built with passion for solving real business problems through technology** 🚀

*Last Updated: March 2026*
