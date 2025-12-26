# Hotel Management System (PMS) - Documentation Index

## Overview

This directory contains comprehensive documentation for the Hotel Property Management System (PMS). All documents are production-ready and designed for enterprise use.

---

## Documentation Files

### 1. [USE_CASES.md](./USE_CASES.md)
**Purpose:** Comprehensive use case documentation  
**Contents:**
- System actors and roles
- Detailed use cases by module (12 modules, 100+ use cases)
- Use case details with preconditions, main flows, and alternatives
- Non-functional requirements
- Glossary and related documents

**Key Sections:**
- Authentication & Authorization (6 use cases)
- Guest Management (7 use cases)
- Room Management (9 use cases)
- Reservation Management (12 use cases)
- Invoice & Payment Management (9 use cases)
- Housekeeping Management (7 use cases)
- Maintenance Management (7 use cases)
- Expense Management (7 use cases)
- Reporting & Analytics (8 use cases)
- Audit & Compliance (5 use cases)
- Beds24 Integration (8 use cases)
- Notifications (6 use cases)

---

### 2. [ERD.md](./ERD.md)
**Purpose:** Entity Relationship Diagram  
**Contents:**
- Visual ERD using Mermaid syntax
- Entity descriptions with key attributes
- Relationship definitions
- Index and constraint information
- Data type specifications

**Key Entities:**
- Core: Users, Hotel Settings
- Guest Management: Guests, Guest Notes
- Room Management: Rooms, Room Features
- Reservations: Reservations, Reservation Guests
- Financial: Invoices, Payments, Expenses
- Operations: Housekeeping, Maintenance Requests
- System: Audit Logs, Notifications
- Integration: Beds24 Sync, Sync Logs

**Total Entities:** 19 tables (single hotel property, ~30 rooms)

---

### 3. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
**Purpose:** Detailed database schema documentation  
**Contents:**
- Complete table definitions with SQL DDL
- Column specifications with data types
- Foreign key relationships
- Indexes and constraints
- Triggers and functions
- Data dictionary with enums

**Key Features:**
- 19 core tables (optimized for single hotel with ~30 rooms)
- UUID primary keys throughout
- Soft delete support for critical entities
- JSONB for flexible data storage
- Comprehensive indexing strategy
- Check constraints for data integrity
- Automatic timestamp management
- Single hotel_settings table for configuration

---

### 4. [ARCHITECTURE.md](./ARCHITECTURE.md)
**Purpose:** System architecture documentation  
**Contents:**
- System architecture diagrams
- Beds24 integration architecture
- Audit logging system
- Security architecture (authentication & authorization)
- Data flow patterns
- Scalability considerations
- Tech stack summary

---

## Quick Reference

### For Developers
1. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
2. Review [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for database structure
3. Check [ERD.md](./ERD.md) for entity relationships
4. Reference [USE_CASES.md](./USE_CASES.md) for business logic

### For Business Analysts
1. Start with [USE_CASES.md](./USE_CASES.md) for functionality
2. Review [ERD.md](./ERD.md) for data model understanding
3. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system capabilities

### For Database Administrators
1. Start with [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for schema details
2. Review [ERD.md](./ERD.md) for relationships
3. Check indexes and constraints in schema document

---

## Document Status

| Document | Version | Status | Last Updated |
|----------|---------|--------|--------------|
| USE_CASES.md | 1.0 | ✅ Production Ready | Dec 2024 |
| ERD.md | 1.0 | ✅ Production Ready | Dec 2024 |
| DATABASE_SCHEMA.md | 1.0 | ✅ Production Ready | Dec 2024 |
| ARCHITECTURE.md | 1.0 | ✅ Production Ready | Dec 2024 |

---

## System Statistics

- **Total Use Cases:** 100+
- **Total Entities:** 20 tables
- **User Roles:** 7 roles
- **Reservation Statuses:** 4 statuses
- **Room Types:** 3 types
- **Payment Methods:** 4 methods
- **Notification Types:** 6 types

---

## Related Documentation

- [Backend README](../backend/README.md) - Backend setup and configuration
- [Backend DATABASE.md](../backend/DATABASE.md) - Database setup guide
- [Frontend README](../frontend/README.md) - Frontend setup and configuration

---

## Document Maintenance

These documents should be updated when:
- New features are added
- Database schema changes
- Use cases are modified
- Architecture changes
- New integrations are added

---

**Last Updated:** December 2024  
**Maintained By:** Development Team

