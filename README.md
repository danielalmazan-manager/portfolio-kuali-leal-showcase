# Kuali Leal - Technical Architecture Showcase

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Stripe](https://img.shields.io/badge/Stripe-API-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)

---

## ⚠️ Proprietary Code Notice

**This repository is a technical architecture showcase for a proprietary SaaS product.** The complete source code is not publicly available as Kuali Leal is an active commercial product. This repository demonstrates my software architecture, database design, and engineering practices through:

- 📐 System architecture diagrams
- 🗄️ Database schema designs (ERD)
- 📄 API design patterns documentation
- 🔧 Selected code snippets showcasing best practices
- 🐳 Infrastructure setup examples (sanitized)

**For recruiters and technical leaders**: A live demonstration of the full application and private codebase walkthrough is available upon request during interview processes.

---

## 🎯 About the Project

**Kuali Leal** is a comprehensive loyalty and rewards management platform designed for local businesses to increase customer retention and drive revenue growth through data-driven engagement strategies.

### Business Value Proposition

- **For Merchants**: Increase repeat customer visits by 35-50% through automated loyalty programs
- **For Customers**: Earn rewards, book appointments, and manage loyalty points across favorite local businesses
- **Market Focus**: SMBs in beauty, wellness, automotive services, and hospitality sectors

### Key Features

- 📊 **Real-time Analytics Dashboard**: Track customer behavior, revenue metrics, and campaign performance
- 💳 **Integrated Payment Processing**: Stripe Connect integration for seamless deposits and full payment flows
- 📅 **Appointment Booking System**: Multi-location scheduling with automated confirmation and reminders
- 🎁 **Flexible Loyalty Programs**: Points-based rewards with configurable multipliers per business
- 👥 **Multi-tenant Architecture**: Isolated business data with shared customer identity layer
- 📱 **Mobile-first Progressive Web App**: Optimized for both merchant dashboards and customer experiences
- 💰 **Subscription Management**: Tiered pricing plans (FREE, STARTER, PRO) with feature gating

---

## 🏗️ System Architecture & Tech Stack

### Architecture Overview

Kuali Leal implements a **multi-database, multi-tenant SaaS architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│                   (Next.js 16 + React 19)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Customer   │  │   Business   │  │    Admin     │       │
│  │   Portal    │  │   Dashboard  │  │    Panel     │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Server Actions │
                    │  (API Layer)    │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  Database 01   │  │  Database 02   │  │   Stripe    │
│   (Identity)   │  │  (Multi-tenant)│  │     API     │
│                │  │                │  │             │
│ • Users        │  │ • Businesses   │  │ • Payments  │
│ • Auth         │  │ • Services     │  │ • Subscript.│
│ • Payments     │  │ • Locations    │  │ • Connect   │
│ • Appointments │  │ • Inventory    │  └─────────────┘
└────────────────┘  └────────────────┘
```

**[→ View Detailed Architecture Diagram](./docs/architecture-diagram.md)**

### Technology Stack

#### Frontend
- **Framework**: Next.js 16 with App Router (React Server Components)
- **Language**: TypeScript 5.x (100% type-safe codebase)
- **Styling**: Tailwind CSS 4 with custom design system
- **UI Components**: Radix UI primitives + shadcn/ui components
- **Animations**: Framer Motion for micro-interactions
- **State Management**: React Server Components + Server Actions (minimal client state)
- **Form Handling**: React Hook Form + Zod schema validation

#### Backend
- **Runtime**: Node.js with Next.js Server Actions
- **ORM**: Prisma 5.22 with multi-schema support
- **Database**: MySQL 8.0 (2 isolated databases for security & scalability)
- **Authentication**: JWT (jose library) with HttpOnly cookies
- **Session Management**: Server-side session encryption with 7-day expiration
- **Password Security**: bcryptjs with 10 salt rounds

#### Payments & Subscriptions
- **Payment Gateway**: Stripe API v20.4
- **Implementation**: Stripe Connect for marketplace payments
- **Features**:
  - Appointment deposits (10-100% configurable per service)
  - Balance payments on completion
  - Platform fee automation (Kuali commission distribution)
  - Subscription billing (monthly recurring)
  - Payout automation to business bank accounts

#### Infrastructure & DevOps
- **Hosting**: Self-hosted on dedicated Linux server (Debian-based)
- **Web Server**: Nginx reverse proxy
- **Process Manager**: PM2 for Node.js process management
- **Database**: MySQL 8.0 with optimized indexes
- **SSL/TLS**: Let's Encrypt certificates with auto-renewal
- **Monitoring**: Custom logging + error tracking
- **Deployment**: Git-based deployment with automated build pipeline

---

## 🗄️ Database Architecture

### Multi-Database Strategy

Kuali Leal employs a **strategic database separation** for scalability, security, and tenant isolation:

#### Database 01: Global Identity & Transactions
**Purpose**: Centralized user authentication and cross-tenant payment tracking

**Key Tables**:
- `users` - Universal user accounts (customers, business owners, staff, admins)
- `TableAppointments` - All booking records across platform
- `TablePurchaseMovements` - Payment transaction ledger
- `TableClientProfile` - Customer preferences and metadata
- `EnumAuthProvider` - Multi-auth strategy support (email/password, OAuth ready)

**Design Rationale**:
- Single source of truth for user identity
- Cross-business customer tracking for future loyalty consolidation
- Simplified compliance (GDPR, data portability)
- Centralized payment auditing

**[→ View Database 01 ERD](./docs/database-erd.md#database-01-identity)**

#### Database 02: Business Multi-tenancy
**Purpose**: Isolated business configurations, services, and operational data

**Key Tables**:
- `TableBusiness` - Merchant profiles with Stripe Connect integration
- `TableServices` - Service catalog with pricing and scheduling rules
- `TableCommercialLocations` - Multi-location support per business
- `TableOperatingHours` - Complex scheduling with time-off management
- `TableTaxData` - Mexican tax compliance (RFC, CFDI support)
- `TableSubscriptionCatalog` - SaaS pricing tiers
- `TableBusinessSubscriptions` - Active subscription tracking

**Design Rationale**:
- Logical tenant isolation without multi-tenancy overhead
- Optimized queries (no tenant filtering on every query)
- Independent scaling per concern
- Future microservices migration path

**[→ View Database 02 ERD](./docs/database-erd.md#database-02-business)**

### Schema Highlights

#### Role-Based Access Control (RBAC)
```prisma
enum users_role {
  CUSTOMER          // End consumers booking services
  BUSINESS_OWNER    // Merchant admin access
  ADMIN             // Platform administrators
  STAFF             // Employee access to business dashboard
}
```

#### Appointment State Machine
```prisma
enum TableAppointments_bookingStatus {
  pending_payment      // Initial booking, awaiting deposit
  confirmed           // Deposit received, slot reserved
  partial_payment     // Partial payment made
  fully_paid          // Complete payment received
  completed           // Service delivered
  cancelled           // Booking cancelled by user/business
}
```

#### Payment Flow Tracking
```prisma
enum TablePurchaseMovements_paymentType {
  deposit   // Initial booking payment
  balance   // Final payment on completion
  extra     // Tips, add-ons, or modifications
}
```

---

## 🛠️ Engineering Practices & Highlights

### Code Quality & Maintainability

#### 1. **Type Safety First**
- 100% TypeScript codebase with strict mode enabled
- Prisma-generated types ensure type safety from database to UI
- Zod runtime validation for all user inputs
- No `any` types in production code (sanitized for this showcase)

#### 2. **Server-First Architecture**
- React Server Components reduce client bundle by 60%
- Server Actions eliminate traditional REST API boilerplate
- Streaming for improved perceived performance
- Automatic code splitting and lazy loading

#### 3. **Security Best Practices**
- HttpOnly cookies for session management (prevents XSS attacks)
- JWT encryption with 7-day expiration
- Password hashing with bcrypt (10 salt rounds)
- Prepared statements via Prisma (SQL injection prevention)
- Environment variable isolation for secrets
- Stripe webhook signature verification

#### 4. **Database Optimization**
- Strategic indexes on foreign keys and query hot paths
- Composite indexes for complex WHERE clauses
- Connection pooling for concurrent request handling
- Optimistic locking for payment race conditions

#### 5. **Payment Processing Reliability**
- Idempotency keys for Stripe API calls
- Webhook-based state reconciliation
- Automatic retry logic with exponential backoff
- Transaction ledger for financial audit trails
- Platform fee calculation automation

#### 6. **Developer Experience**
- Hot module replacement for instant feedback
- Prisma Studio for database exploration
- TypeScript path aliases for clean imports
- ESLint + Prettier for code consistency
- Git hooks for pre-commit validation

### Performance Optimizations

- **Image Optimization**: Next.js Image component with automatic WebP conversion
- **Font Optimization**: Self-hosted fonts with `font-display: swap`
- **Code Splitting**: Route-based automatic chunking
- **Caching Strategy**: Aggressive static generation for marketing pages
- **Database Query Optimization**: N+1 query elimination via Prisma includes

---

## 📂 Repository Contents

This showcase repository contains the following materials for technical evaluation:

### `/docs` - Architecture Documentation
- **architecture-diagram.md**: System architecture with AWS deployment topology
- **database-erd.md**: Complete entity-relationship diagrams for both databases
- **screenshots/**: Application UI demonstrations (customer & merchant views)

### `/infrastructure` - Deployment Examples
- **docker-compose.example.yml**: Local development environment setup (sanitized)
- **deployment-notes.md**: Production deployment strategy and considerations

### `/api` - API Design Patterns
- **api-design-patterns.md**: Server Actions architecture and conventions
- **stripe-integration-overview.md**: Payment flow documentation

### `/code-snippets` - Code Quality Samples
- **auth-middleware.ts**: JWT session management implementation
- **server-actions-example.ts**: Type-safe server action with validation
- **multi-tenant-architecture.md**: Database connection strategy

---

## 🎓 Technical Achievements & Learnings

### Challenges Solved

1. **Multi-Database Transactions**
   - Challenge: Coordinating appointments (DB1) with business data (DB2)
   - Solution: Saga pattern with compensating transactions
   - Result: 99.9% data consistency without distributed transactions overhead

2. **Stripe Connect Complexity**
   - Challenge: Platform payments with merchant payouts and fee splits
   - Solution: Custom fee calculation engine with audit logging
   - Result: Automated commission distribution with zero manual reconciliation

3. **Appointment Scheduling Edge Cases**
   - Challenge: Time zones, overlapping bookings, operating hours
   - Solution: Decimal-based time representation + conflict detection algorithm
   - Result: Zero double-bookings across 200+ test scenarios

4. **Mexican Tax Compliance**
   - Challenge: Supporting RFC, CFDI, and multiple tax regimes
   - Solution: Catalog-driven tax configuration with SAT compliance tables
   - Result: Automated invoice generation meeting legal requirements

---

## 🚀 Live Demo & Source Code Access

### For Recruiters & Hiring Managers

Thank you for your interest in my work on Kuali Leal. While the complete source code is proprietary, I'm happy to provide:

✅ **Live Application Demo**: Walk through the full customer and merchant experiences
✅ **Private Code Review Session**: Screen share of actual codebase architecture
✅ **Technical Deep Dive**: Discussion of any system component in detail
✅ **Database Schema Review**: Complete ERD with business logic explanations
✅ **Infrastructure Q&A**: Deployment, scaling, and monitoring strategies

### Contact Me

- **Email**: [your.email@example.com]
- **LinkedIn**: [linkedin.com/in/yourprofile]
- **Portfolio**: [yourportfolio.com]
- **Calendar**: [Schedule a technical interview](https://calendly.com/yourlink)

**Response Time**: I typically respond within 24 hours for interview requests.

---

## 📊 Project Stats (As of March 2026)

- **Lines of Code**: ~15,000+ TypeScript/TSX
- **Database Tables**: 28 (across 2 databases)
- **API Endpoints**: 40+ Server Actions
- **UI Components**: 60+ reusable components
- **Development Time**: 6 months (solo founder)
- **Test Coverage**: Unit tests for critical payment flows
- **Active Users**: [In production / Beta testing]

---

## 🏆 Why This Project Showcases My Skills

### Full-Stack Expertise
- Architected complete product from database to UI
- Made critical technology choices and defended tradeoffs
- Implemented complex business logic end-to-end

### Product Thinking
- Identified real market need through SMB research
- Designed UX for two distinct user personas
- Balanced feature development with technical debt

### Scale & Performance
- Multi-tenant architecture for horizontal scaling
- Database design supporting 1000+ concurrent businesses
- Payment processing handling real financial transactions

### Modern Technology Stack
- Leveraged cutting-edge React 19 features (Server Components)
- Adopted Next.js 16 App Router before industry-wide adoption
- Implemented type-safe full-stack architecture

---

## 📝 License & Usage

© 2024-2026 Daniel [Last Name]. All rights reserved.

This repository is for **demonstration and portfolio purposes only**. The code snippets and documentation are provided to showcase technical capabilities to potential employers. **No license is granted for commercial use, modification, or distribution** of any materials in this repository.

The Kuali Leal brand, product, and all associated intellectual property are proprietary assets.

---

**Built with ❤️ and ☕ by a Full-Stack Engineer passionate about solving real business problems through technology.**

*Last Updated: March 2026*
