# Hotel Management System (PMS) - Database Schema Diagram

## Document Information

- **Version:** 1.0
- **Date:** December 2024
- **Status:** Production Ready
- **Database:** PostgreSQL 14+
- **System:** Hotel Property Management System (PMS)

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Table Definitions](#table-definitions)
3. [Relationships](#relationships)
4. [Indexes](#indexes)
5. [Constraints](#constraints)
6. [Triggers and Functions](#triggers-and-functions)
7. [Data Dictionary](#data-dictionary)

---

## Schema Overview

The database schema consists of 19 core tables organized into logical groups for a single hotel property with approximately 30 rooms:

- **Core Entities**: users, hotel_settings
- **Guest Management**: guests, guest_notes
- **Room Management**: rooms, room_features
- **Reservations**: reservations, reservation_guests
- **Financial**: invoices, payments, expenses, expense_categories
- **Operations**: housekeeping, maintenance_requests
- **System**: audit_logs, notifications
- **Integration**: beds24_sync, sync_logs

All tables use UUID primary keys and include standard timestamps (created_at, updated_at). Soft-deletable tables include deleted_at.

**Note:** This schema is optimized for a single hotel property. The `hotel_settings` table stores hotel configuration instead of a multi-property `properties` table.

---

## Table Definitions

### 1. hotel_settings

Stores hotel configuration and settings. Single record table for the hotel property.

```sql
CREATE TABLE hotel_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    hotel_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    check_in_time TIME DEFAULT '15:00:00',
    check_out_time TIME DEFAULT '11:00:00',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one record exists
CREATE UNIQUE INDEX idx_hotel_settings_single ON hotel_settings((1));
```

**Columns:**
- `id` (UUID, PK): Fixed UUID for single hotel record
- `hotel_name` (VARCHAR(255)): Hotel name
- `address` (TEXT): Street address
- `city` (VARCHAR(100)): City name
- `country` (VARCHAR(100)): Country name
- `phone` (VARCHAR(50)): Contact phone
- `email` (VARCHAR(255)): Contact email
- `tax_rate` (DECIMAL(5,2)): Tax rate percentage
- `currency` (VARCHAR(10)): Currency code
- `timezone` (VARCHAR(50)): Hotel timezone
- `check_in_time` (TIME): Standard check-in time
- `check_out_time` (TIME): Standard check-out time
- `settings` (JSONB): Additional flexible configuration
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Note:** This table is designed to hold a single record. The unique index on a constant expression ensures only one hotel configuration can exist. The default UUID is fixed to maintain consistency.

---

### 2. users

Stores system users with role-based access control.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FRONT_DESK', 
        'HOUSEKEEPING', 'MAINTENANCE', 'VIEWER'
    )),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    refresh_token TEXT,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
```

**Columns:**
- `id` (UUID, PK): Unique user identifier
- `email` (VARCHAR(255), UNIQUE): User email
- `password_hash` (VARCHAR(255)): Bcrypt hashed password
- `first_name` (VARCHAR(100)): First name
- `last_name` (VARCHAR(100)): Last name
- `role` (VARCHAR(50), CHECK): User role enum
- `is_active` (BOOLEAN): Account active status
- `last_login` (TIMESTAMP): Last login timestamp
- `refresh_token` (TEXT): JWT refresh token
- `refresh_token_expires_at` (TIMESTAMP): Token expiration
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `deleted_at` (TIMESTAMP): Soft delete timestamp

---

### 3. guests

Stores guest profiles with contact information and history.

```sql
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    past_stays INTEGER DEFAULT 0,
    notes TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_phone ON guests(phone);
CREATE INDEX idx_guests_name ON guests(name);
CREATE INDEX idx_guests_deleted_at ON guests(deleted_at) WHERE deleted_at IS NULL;
```

**Columns:**
- `id` (UUID, PK): Unique guest identifier
- `name` (VARCHAR(255)): Guest full name
- `email` (VARCHAR(255)): Email address
- `phone` (VARCHAR(50)): Phone number
- `past_stays` (INTEGER): Number of previous stays
- `notes` (TEXT): General notes
- `preferences` (JSONB): Guest preferences (room type, floor, etc.)
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `deleted_at` (TIMESTAMP): Soft delete timestamp

---

### 4. rooms

Stores room information including status, pricing, and features.

```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Single', 'Double', 'Suite')),
    status VARCHAR(50) NOT NULL DEFAULT 'Available' CHECK (status IN (
        'Available', 'Occupied', 'Cleaning', 'Out of Service'
    )),
    price_per_night DECIMAL(10, 2) NOT NULL,
    floor INTEGER NOT NULL,
    features JSONB DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_type ON rooms(type);
CREATE INDEX idx_rooms_room_number ON rooms(room_number);
```

**Columns:**
- `id` (UUID, PK): Unique room identifier
- `room_number` (VARCHAR(50), UNIQUE): Room number/identifier (e.g., "101", "202")
- `type` (VARCHAR(50), CHECK): Room type enum
- `status` (VARCHAR(50), CHECK): Current room status
- `price_per_night` (DECIMAL(10,2)): Room rate
- `floor` (INTEGER): Floor number
- `features` (JSONB): Array of features (WiFi, TV, AC, etc.)
- `description` (TEXT): Room description
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Unique constraint on room_number (single hotel, so room numbers are globally unique)

---

### 5. reservations

Stores reservation information with check-in/out dates and status.

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    primary_guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Confirmed' CHECK (status IN (
        'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'
    )),
    total_amount DECIMAL(10, 2) NOT NULL,
    source VARCHAR(50) DEFAULT 'Direct' CHECK (source IN (
        'Direct', 'Beds24', 'Booking.com', 'Expedia', 'Other'
    )),
    beds24_booking_id VARCHAR(255),
    special_requests TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (check_out > check_in)
);

CREATE INDEX idx_reservations_room_id ON reservations(room_id);
CREATE INDEX idx_reservations_primary_guest_id ON reservations(primary_guest_id);
CREATE INDEX idx_reservations_check_in ON reservations(check_in);
CREATE INDEX idx_reservations_check_out ON reservations(check_out);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_beds24_booking_id ON reservations(beds24_booking_id);
CREATE INDEX idx_reservations_deleted_at ON reservations(deleted_at) WHERE deleted_at IS NULL;

-- Partial unique index to prevent overlapping reservations
CREATE UNIQUE INDEX idx_reservations_no_overlap 
ON reservations(room_id, check_in, check_out) 
WHERE status != 'Cancelled' AND deleted_at IS NULL;
```

**Columns:**
- `id` (UUID, PK): Unique reservation identifier
- `room_id` (UUID, FK): Assigned room
- `primary_guest_id` (UUID, FK): Primary guest
- `check_in` (DATE): Check-in date
- `check_out` (DATE): Check-out date
- `status` (VARCHAR(50), CHECK): Reservation status
- `total_amount` (DECIMAL(10,2)): Total reservation amount
- `source` (VARCHAR(50), CHECK): Booking source
- `beds24_booking_id` (VARCHAR(255)): External booking reference
- `special_requests` (TEXT): Guest special requests
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `deleted_at` (TIMESTAMP): Soft delete timestamp

**Constraints:**
- Check constraint: check_out > check_in
- Partial unique index prevents overlapping reservations for same room

---

### 6. reservation_guests

Junction table for many-to-many relationship between reservations and guests (supports double rooms).

```sql
CREATE TABLE reservation_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    guest_type VARCHAR(50) NOT NULL DEFAULT 'Primary' CHECK (guest_type IN (
        'Primary', 'Secondary'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reservation_id, guest_id)
);

CREATE INDEX idx_reservation_guests_reservation_id ON reservation_guests(reservation_id);
CREATE INDEX idx_reservation_guests_guest_id ON reservation_guests(guest_id);
CREATE INDEX idx_reservation_guests_guest_type ON reservation_guests(guest_type);
```

**Columns:**
- `id` (UUID, PK): Unique identifier
- `reservation_id` (UUID, FK): Reservation reference
- `guest_id` (UUID, FK): Guest reference
- `guest_type` (VARCHAR(50), CHECK): Primary or Secondary guest
- `created_at` (TIMESTAMP): Creation timestamp

**Constraints:**
- Unique constraint on (reservation_id, guest_id)

---

### 7. invoices

Stores invoice information generated from reservations.

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN (
        'Pending', 'Paid', 'Cancelled', 'Overdue'
    )),
    payment_method VARCHAR(50) CHECK (payment_method IN (
        'Cash', 'Card', 'Online', 'Bank Transfer'
    )),
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (due_date >= issue_date)
);

CREATE INDEX idx_invoices_reservation_id ON invoices(reservation_id);
CREATE INDEX idx_invoices_guest_id ON invoices(guest_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_paid_at ON invoices(paid_at);
```

**Columns:**
- `id` (UUID, PK): Unique invoice identifier
- `reservation_id` (UUID, FK): Associated reservation
- `guest_id` (UUID, FK): Billed guest
- `issue_date` (DATE): Invoice issue date
- `due_date` (DATE): Payment due date
- `amount` (DECIMAL(10,2)): Invoice amount
- `status` (VARCHAR(50), CHECK): Invoice status
- `payment_method` (VARCHAR(50), CHECK): Payment method used
- `notes` (TEXT): Additional notes
- `paid_at` (TIMESTAMP): Payment timestamp
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Check constraint: due_date >= issue_date

---

### 8. payments

Stores individual payment transactions for invoices.

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
        'Cash', 'Card', 'Online', 'Bank Transfer'
    )),
    transaction_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
```

**Columns:**
- `id` (UUID, PK): Unique payment identifier
- `invoice_id` (UUID, FK): Associated invoice
- `amount` (DECIMAL(10,2)): Payment amount
- `payment_method` (VARCHAR(50), CHECK): Payment method
- `transaction_id` (VARCHAR(255)): External transaction reference
- `paid_at` (TIMESTAMP): Payment timestamp
- `created_at` (TIMESTAMP): Creation timestamp

---

### 9. housekeeping

Tracks room cleaning status and staff assignments.

```sql
CREATE TABLE housekeeping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Clean' CHECK (status IN (
        'Clean', 'Dirty', 'In Progress'
    )),
    assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    last_cleaned TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_housekeeping_room_id ON housekeeping(room_id);
CREATE INDEX idx_housekeeping_status ON housekeeping(status);
CREATE INDEX idx_housekeeping_assigned_staff_id ON housekeeping(assigned_staff_id);
CREATE INDEX idx_housekeeping_last_cleaned ON housekeeping(last_cleaned);
```

**Columns:**
- `id` (UUID, PK): Unique identifier
- `room_id` (UUID, FK, UNIQUE): Associated room (one-to-one)
- `status` (VARCHAR(50), CHECK): Cleaning status
- `assigned_staff_id` (UUID, FK): Assigned housekeeping staff
- `last_cleaned` (TIMESTAMP): Last cleaning timestamp
- `notes` (TEXT): Cleaning notes
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Unique constraint on room_id (one-to-one relationship)

---

### 10. maintenance_requests

Stores maintenance requests for rooms.

```sql
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium' CHECK (priority IN (
        'Low', 'Medium', 'High', 'Urgent'
    )),
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN (
        'Open', 'In Progress', 'Repaired', 'Cancelled'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_maintenance_requests_room_id ON maintenance_requests(room_id);
CREATE INDEX idx_maintenance_requests_assigned_to_id ON maintenance_requests(assigned_to_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_priority ON maintenance_requests(priority);
CREATE INDEX idx_maintenance_requests_created_at ON maintenance_requests(created_at);
```

**Columns:**
- `id` (UUID, PK): Unique request identifier
- `room_id` (UUID, FK): Associated room
- `assigned_to_id` (UUID, FK): Assigned maintenance staff
- `title` (VARCHAR(255)): Request title
- `description` (TEXT): Detailed description
- `priority` (VARCHAR(50), CHECK): Priority level
- `status` (VARCHAR(50), CHECK): Request status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `resolved_at` (TIMESTAMP): Resolution timestamp

---

### 11. expenses

Stores hotel operational expenses.

```sql
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
```

**Columns:**
- `id` (UUID, PK): Unique expense identifier
- `category` (VARCHAR(100)): Expense category
- `amount` (DECIMAL(10,2)): Expense amount
- `expense_date` (DATE): Date of expense
- `notes` (TEXT): Additional notes
- `receipt_url` (TEXT): Receipt file path/URL
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

---

### 12. expense_categories

Predefined expense categories.

```sql
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expense_categories_name ON expense_categories(name);
```

**Columns:**
- `id` (UUID, PK): Unique category identifier
- `name` (VARCHAR(100), UNIQUE): Category name
- `description` (TEXT): Category description
- `created_at` (TIMESTAMP): Creation timestamp

---

### 13. audit_logs

Tracks all system changes for compliance and debugging.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_lookup ON audit_logs(entity_type, entity_id);
```

**Columns:**
- `id` (UUID, PK): Unique log identifier
- `user_id` (UUID, FK): User who performed action
- `action` (VARCHAR(100)): Action performed (CREATE, UPDATE, DELETE)
- `entity_type` (VARCHAR(100)): Type of entity modified
- `entity_id` (UUID): ID of modified entity
- `before_state` (JSONB): State before change
- `after_state` (JSONB): State after change
- `ip_address` (INET): Request IP address
- `user_agent` (TEXT): Request user agent
- `created_at` (TIMESTAMP): Log timestamp

---

### 14. notifications

Stores system notifications for users.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'checkin', 'checkout', 'invoice', 'cleaning', 'maintenance', 'system'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

**Columns:**
- `id` (UUID, PK): Unique notification identifier
- `user_id` (UUID, FK): Recipient user
- `type` (VARCHAR(50), CHECK): Notification type
- `title` (VARCHAR(255)): Notification title
- `message` (TEXT): Notification message
- `link` (VARCHAR(500)): Optional navigation link
- `is_read` (BOOLEAN): Read status
- `created_at` (TIMESTAMP): Creation timestamp

---

### 15. beds24_sync

Tracks synchronization status with Beds24 channel manager.

```sql
CREATE TABLE beds24_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN (
        'PUSH', 'PULL', 'WEBHOOK'
    )),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN (
        'Pending', 'Success', 'Failed', 'Conflict'
    )),
    sync_data JSONB,
    error_message TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_beds24_sync_status ON beds24_sync(status);
CREATE INDEX idx_beds24_sync_sync_type ON beds24_sync(sync_type);
CREATE INDEX idx_beds24_sync_last_sync_at ON beds24_sync(last_sync_at);
```

**Columns:**
- `id` (UUID, PK): Unique sync identifier
- `sync_type` (VARCHAR(50), CHECK): Type of sync operation
- `status` (VARCHAR(50), CHECK): Sync status
- `sync_data` (JSONB): Sync payload data
- `error_message` (TEXT): Error details if failed
- `last_sync_at` (TIMESTAMP): Last successful sync timestamp
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

---

### 16. sync_logs

Detailed logs for each Beds24 sync operation.

```sql
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID NOT NULL REFERENCES beds24_sync(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'Success', 'Failed', 'Retry'
    )),
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_logs_sync_id ON sync_logs(sync_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at);
```

**Columns:**
- `id` (UUID, PK): Unique log identifier
- `sync_id` (UUID, FK): Associated sync record
- `action` (VARCHAR(100)): Specific sync action
- `status` (VARCHAR(50), CHECK): Operation status
- `error_message` (TEXT): Error details
- `request_data` (JSONB): Request payload
- `response_data` (JSONB): Response payload
- `created_at` (TIMESTAMP): Log timestamp

---

### 17. room_features

Individual room features (normalized from JSONB for better querying).

```sql
CREATE TABLE room_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, feature_name)
);

CREATE INDEX idx_room_features_room_id ON room_features(room_id);
CREATE INDEX idx_room_features_feature_name ON room_features(feature_name);
```

**Columns:**
- `id` (UUID, PK): Unique identifier
- `room_id` (UUID, FK): Associated room
- `feature_name` (VARCHAR(100)): Feature name
- `created_at` (TIMESTAMP): Creation timestamp

**Constraints:**
- Unique constraint on (room_id, feature_name)

---

### 18. guest_notes

Additional notes about guests with creator tracking.

```sql
CREATE TABLE guest_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guest_notes_guest_id ON guest_notes(guest_id);
CREATE INDEX idx_guest_notes_created_by_id ON guest_notes(created_by_id);
CREATE INDEX idx_guest_notes_created_at ON guest_notes(created_at);
```

**Columns:**
- `id` (UUID, PK): Unique note identifier
- `guest_id` (UUID, FK): Associated guest
- `created_by_id` (UUID, FK): User who created note
- `note` (TEXT): Note content
- `created_at` (TIMESTAMP): Creation timestamp

---

## Relationships

### Foreign Key Relationships

1. **reservations** → **rooms** (room_id)
   - ON DELETE RESTRICT (cannot delete room with active reservations)

5. **reservations** → **guests** (primary_guest_id)
   - ON DELETE RESTRICT

6. **reservation_guests** → **reservations** (reservation_id)
   - ON DELETE CASCADE

7. **reservation_guests** → **guests** (guest_id)
   - ON DELETE RESTRICT

8. **invoices** → **reservations** (reservation_id)
   - ON DELETE SET NULL (invoice remains if reservation deleted)

9. **invoices** → **guests** (guest_id)
   - ON DELETE RESTRICT

10. **payments** → **invoices** (invoice_id)
    - ON DELETE CASCADE

11. **housekeeping** → **rooms** (room_id)
    - ON DELETE CASCADE
    - UNIQUE constraint (one-to-one)

12. **housekeeping** → **users** (assigned_staff_id)
    - ON DELETE SET NULL

13. **maintenance_requests** → **rooms** (room_id)
    - ON DELETE CASCADE

14. **maintenance_requests** → **users** (assigned_to_id)
    - ON DELETE SET NULL

15. **audit_logs** → **users** (user_id)
    - ON DELETE SET NULL

16. **notifications** → **users** (user_id)
    - ON DELETE CASCADE

17. **sync_logs** → **beds24_sync** (sync_id)
    - ON DELETE CASCADE

18. **room_features** → **rooms** (room_id)
    - ON DELETE CASCADE

19. **guest_notes** → **guests** (guest_id)
    - ON DELETE CASCADE

20. **guest_notes** → **users** (created_by_id)
    - ON DELETE SET NULL

---

## Indexes

### Performance Indexes

All foreign keys are indexed for join performance. Additional indexes:

- **Time-based queries**: created_at, updated_at, check_in, check_out, expense_date
- **Status filtering**: status columns on reservations, invoices, maintenance_requests
- **Search operations**: email, name, room_number
- **Composite indexes**: (property_id, room_number), (entity_type, entity_id)
- **Partial indexes**: WHERE deleted_at IS NULL for soft-deleted records

---

## Constraints

### Check Constraints

1. **users.role**: Must be valid role enum
2. **rooms.type**: Must be Single, Double, or Suite
3. **rooms.status**: Must be valid status enum
4. **reservations.status**: Must be valid status enum
5. **reservations.check_out > check_in**: Check-out must be after check-in
6. **invoices.due_date >= issue_date**: Due date must be on or after issue date
7. **housekeeping.status**: Must be valid status enum
8. **maintenance_requests.priority**: Must be valid priority enum
9. **maintenance_requests.status**: Must be valid status enum
10. **notifications.type**: Must be valid notification type enum
11. **beds24_sync.sync_type**: Must be valid sync type enum
12. **beds24_sync.status**: Must be valid sync status enum

### Unique Constraints

1. **users.email**: Unique email per user
2. **rooms(property_id, room_number)**: Unique room number per property
3. **reservation_guests(reservation_id, guest_id)**: Unique guest per reservation
4. **reservations(room_id, check_in, check_out)**: No overlapping reservations (partial index)
5. **expense_categories.name**: Unique category name
6. **room_features(room_id, feature_name)**: Unique feature per room
7. **housekeeping.room_id**: One-to-one relationship with rooms

---

## Triggers and Functions

### Automatic Timestamp Updates

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (apply to all tables with updated_at column)
```

### Auto-generate Invoice on Check-out

```sql
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Checked-out' AND OLD.status != 'Checked-out' THEN
        INSERT INTO invoices (
            reservation_id, guest_id, issue_date, due_date, 
            amount, status
        ) VALUES (
            NEW.id, NEW.primary_guest_id, CURRENT_DATE, 
            CURRENT_DATE + INTERVAL '30 days', NEW.total_amount, 'Pending'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER reservation_checkout_invoice
    AFTER UPDATE ON reservations
    FOR EACH ROW
    WHEN (NEW.status = 'Checked-out' AND OLD.status != 'Checked-out')
    EXECUTE FUNCTION auto_generate_invoice();
```

---

## Data Dictionary

### Enumerated Types

#### User Roles
- `SUPER_ADMIN`: Full system access, multi-property
- `ADMIN`: Full property access, user management
- `MANAGER`: Reservations, guests, reports
- `FRONT_DESK`: Check-in/out, reservations, guests
- `HOUSEKEEPING`: Room status updates only
- `MAINTENANCE`: Maintenance requests only
- `VIEWER`: Read-only access

#### Room Types
- `Single`: Single occupancy room
- `Double`: Double occupancy room
- `Suite`: Suite with multiple rooms

#### Room Status
- `Available`: Room is available for booking
- `Occupied`: Room is currently occupied
- `Cleaning`: Room is being cleaned
- `Out of Service`: Room is unavailable (maintenance)

#### Reservation Status
- `Confirmed`: Reservation confirmed, not checked in
- `Checked-in`: Guest has checked in
- `Checked-out`: Guest has checked out
- `Cancelled`: Reservation cancelled

#### Invoice Status
- `Pending`: Invoice not yet paid
- `Paid`: Invoice paid in full
- `Cancelled`: Invoice cancelled
- `Overdue`: Payment past due date

#### Housekeeping Status
- `Clean`: Room is clean and ready
- `Dirty`: Room needs cleaning
- `In Progress`: Room is being cleaned

#### Maintenance Priority
- `Low`: Low priority maintenance
- `Medium`: Medium priority maintenance
- `High`: High priority maintenance
- `Urgent`: Urgent maintenance required

#### Maintenance Status
- `Open`: Request created, not started
- `In Progress`: Maintenance in progress
- `Repaired`: Maintenance completed
- `Cancelled`: Request cancelled

#### Booking Source
- `Direct`: Direct booking
- `Beds24`: Via Beds24 channel manager
- `Booking.com`: Via Booking.com
- `Expedia`: Via Expedia
- `Other`: Other booking source

#### Payment Methods
- `Cash`: Cash payment
- `Card`: Credit/debit card
- `Online`: Online payment
- `Bank Transfer`: Bank transfer

#### Notification Types
- `checkin`: Check-in reminder
- `checkout`: Check-out reminder
- `invoice`: Invoice notification
- `cleaning`: Housekeeping notification
- `maintenance`: Maintenance notification
- `system`: System notification

#### Sync Types
- `PUSH`: Push data to Beds24
- `PULL`: Pull data from Beds24
- `WEBHOOK`: Webhook from Beds24

#### Sync Status
- `Pending`: Sync queued
- `Success`: Sync successful
- `Failed`: Sync failed
- `Conflict`: Sync conflict detected

---

## Notes

1. **Single Hotel Design**: This schema is optimized for a single hotel property with approximately 30 rooms. The `hotel_settings` table stores hotel configuration as a single record.

2. **UUID Primary Keys**: All tables use UUID for better distribution, security, and multi-database support.

3. **Soft Deletes**: Critical entities (users, guests, reservations) support soft deletes via `deleted_at` for data retention.

4. **JSONB Usage**: Flexible data storage for settings, preferences, features, and audit states without schema changes.

5. **Partial Indexes**: Used for soft-deleted records to improve query performance on active records only.

6. **Check Constraints**: Enforce data integrity at database level.

7. **Cascade Behavior**: 
   - CASCADE: Child records deleted when parent deleted
   - RESTRICT: Prevents deletion if child records exist
   - SET NULL: Sets foreign key to NULL when parent deleted

8. **Timestamp Management**: Automatic `updated_at` via triggers.

9. **Overlap Prevention**: Partial unique index prevents overlapping reservations for same room.

10. **Room Number Uniqueness**: Room numbers are globally unique (no property_id needed for single hotel).

---

**Document End**

