# Hotel Management System (PMS) - Use Case Document

## Document Information

- **Version:** 1.0
- **Date:** December 2024
- **Status:** Production Ready
- **System:** Hotel Property Management System (PMS)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Actors](#actors)
3. [Use Cases by Module](#use-cases-by-module)
4. [Use Case Details](#use-case-details)
5. [Non-Functional Requirements](#non-functional-requirements)

---

## Introduction

This document describes the use cases for the Hotel Property Management System (PMS). The system manages hotel operations including reservations, guest management, room management, housekeeping, maintenance, invoicing, and financial reporting.

### System Overview

The PMS is designed for a single hotel property with approximately 30 rooms. The system:
- Streamlines hotel operations and enhances guest experiences
- Optimizes resource management and room allocation
- Integrates with Beds24 channel manager for OTA bookings
- Provides comprehensive reporting and analytics
- Maintains audit trails for compliance
- Supports efficient daily operations for small to medium-sized hotels

---

## Actors

### Primary Actors

1. **Super Admin**
   - Full system access
   - User management and system configuration
   - Complete system oversight

2. **Admin**
   - Full hotel access
   - User management
   - System configuration and settings

3. **Manager**
   - Reservations and guest management
   - Reports and analytics access
   - Operational oversight

4. **Front Desk Staff**
   - Check-in/check-out operations
   - Reservation management
   - Guest information management
   - Invoice viewing

5. **Housekeeping Staff**
   - Room status updates
   - Cleaning status management
   - Housekeeping schedule viewing

6. **Maintenance Staff**
   - Maintenance request creation and management
   - Request status updates
   - Room maintenance tracking

7. **Viewer**
   - Read-only access to all data
   - Report viewing
   - Dashboard access

### Secondary Actors

- **Beds24 Channel Manager** (External System)
  - Receives booking data from PMS
  - Sends booking updates to PMS
  - Syncs room availability and rates

- **System** (Automated Processes)
  - Automated invoice generation
  - Notification generation
  - Audit log creation
  - Background job processing

---

## Use Cases by Module

### 1. Authentication & Authorization

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-001 | Login to System | All Users | High |
| UC-002 | Logout from System | All Users | High |
| UC-003 | Refresh Authentication Token | All Users | Medium |
| UC-004 | Reset Password | All Users | Medium |
| UC-005 | Change Password | All Users | Medium |
| UC-006 | Manage User Roles | Super Admin, Admin | High |

### 2. Guest Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-101 | Create Guest Profile | Admin, Manager, Front Desk | High |
| UC-102 | View Guest Profile | All (with permissions) | High |
| UC-103 | Update Guest Information | Admin, Manager, Front Desk | High |
| UC-104 | Search Guests | All (with permissions) | High |
| UC-105 | View Guest History | Admin, Manager, Front Desk | Medium |
| UC-106 | Merge Duplicate Guest Records | Admin, Manager | Low |
| UC-107 | Add Guest Notes | Admin, Manager, Front Desk | Medium |

### 3. Room Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-201 | Create Room | Admin | High |
| UC-202 | View Room Details | All (with permissions) | High |
| UC-203 | Update Room Information | Admin, Manager | High |
| UC-204 | Update Room Status | Admin, Manager, Housekeeping | High |
| UC-205 | Search/Filter Rooms | All (with permissions) | High |
| UC-206 | View Room Availability | All (with permissions) | High |
| UC-207 | Set Room Rates | Admin, Manager | High |
| UC-208 | Add Room Features | Admin | Medium |
| UC-209 | Mark Room Out of Service | Admin, Manager | Medium |

### 4. Reservation Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-301 | Create Reservation | Admin, Manager, Front Desk | High |
| UC-302 | View Reservation Details | All (with permissions) | High |
| UC-303 | Update Reservation | Admin, Manager, Front Desk | High |
| UC-304 | Cancel Reservation | Admin, Manager, Front Desk | High |
| UC-305 | Check-in Guest | Front Desk, Manager | High |
| UC-306 | Check-out Guest | Front Desk, Manager | High |
| UC-307 | Search Reservations | All (with permissions) | High |
| UC-308 | View Reservation Calendar | All (with permissions) | High |
| UC-309 | Handle Double Room Reservations | Admin, Manager, Front Desk | High |
| UC-310 | Check Room Availability | All (with permissions) | High |
| UC-311 | Modify Reservation Dates | Admin, Manager, Front Desk | Medium |
| UC-312 | Add Second Guest to Reservation | Admin, Manager, Front Desk | Medium |

### 5. Invoice & Payment Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-401 | Create Invoice | Admin, Manager | High |
| UC-402 | View Invoice | All (with permissions) | High |
| UC-403 | Update Invoice Status | Admin, Manager | High |
| UC-404 | Record Payment | Admin, Manager | High |
| UC-405 | Mark Invoice as Paid | Admin, Manager | High |
| UC-406 | Cancel Invoice | Admin, Manager | Medium |
| UC-407 | Generate Invoice PDF | Admin, Manager | Medium |
| UC-408 | View Payment History | Admin, Manager | Medium |
| UC-409 | Auto-generate Invoice on Check-out | System | High |

### 6. Housekeeping Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-501 | View Housekeeping Status | All (with permissions) | High |
| UC-502 | Update Cleaning Status | Housekeeping, Admin, Manager | High |
| UC-503 | Assign Staff to Room | Admin, Manager | Medium |
| UC-504 | Mark Room as Clean | Housekeeping, Admin, Manager | High |
| UC-505 | Mark Room as Dirty | Housekeeping, Admin, Manager | High |
| UC-506 | View Housekeeping Schedule | All (with permissions) | Medium |
| UC-507 | Track Last Cleaned Date | All (with permissions) | Medium |

### 7. Maintenance Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-601 | Create Maintenance Request | Admin, Manager, Front Desk, Maintenance | High |
| UC-602 | View Maintenance Requests | All (with permissions) | High |
| UC-603 | Update Request Status | Maintenance, Admin, Manager | High |
| UC-604 | Assign Priority to Request | Admin, Manager, Maintenance | High |
| UC-605 | Mark Request as Repaired | Maintenance, Admin, Manager | High |
| UC-606 | Search Maintenance Requests | All (with permissions) | Medium |
| UC-607 | View Maintenance History | All (with permissions) | Medium |

### 8. Expense Management

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-701 | Create Expense Record | Admin, Manager | High |
| UC-702 | View Expenses | Admin, Manager, Viewer | High |
| UC-703 | Update Expense | Admin, Manager | Medium |
| UC-704 | Delete Expense | Admin | Medium |
| UC-705 | Categorize Expenses | Admin, Manager | Medium |
| UC-706 | View Expense Reports | Admin, Manager, Viewer | High |
| UC-707 | Filter Expenses by Category | Admin, Manager, Viewer | Medium |

### 9. Reporting & Analytics

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-801 | View Dashboard | All (with permissions) | High |
| UC-802 | Generate Revenue Report | Admin, Manager, Viewer | High |
| UC-803 | Generate Occupancy Report | Admin, Manager, Viewer | High |
| UC-804 | Generate Guest Report | Admin, Manager, Viewer | Medium |
| UC-805 | View Financial Summary | Admin, Manager, Viewer | High |
| UC-806 | Export Reports | Admin, Manager | Medium |
| UC-807 | View Cancellation Rate | Admin, Manager, Viewer | Medium |
| UC-808 | View Occupancy Forecast | Admin, Manager, Viewer | Medium |

### 10. Audit & Compliance

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-901 | View Audit Logs | Super Admin, Admin, Manager, Viewer | High |
| UC-902 | Search Audit Logs | Super Admin, Admin, Manager, Viewer | Medium |
| UC-903 | Export Audit Logs | Super Admin, Admin | Medium |
| UC-904 | Filter Audit Logs by Entity | Super Admin, Admin, Manager, Viewer | Medium |
| UC-905 | View User Activity | Super Admin, Admin | Medium |

### 11. Beds24 Integration

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-1001 | Sync Reservations to Beds24 | System | High |
| UC-1002 | Receive Reservations from Beds24 | System | High |
| UC-1003 | Sync Room Availability | System | High |
| UC-1004 | Sync Room Rates | System | High |
| UC-1005 | Handle Sync Conflicts | Admin, Manager | High |
| UC-1006 | View Sync Status | Admin, Manager, Viewer | Medium |
| UC-1007 | Manual Sync Trigger | Admin | Medium |
| UC-1008 | Configure Beds24 Settings | Admin | High |

### 12. Notifications

| Use Case ID | Use Case Name | Primary Actor | Priority |
|------------|---------------|---------------|----------|
| UC-1101 | View Notifications | All Users | High |
| UC-1102 | Mark Notification as Read | All Users | Medium |
| UC-1103 | Receive Check-in Reminder | All Users | High |
| UC-1104 | Receive Check-out Reminder | All Users | High |
| UC-1105 | Receive Maintenance Alert | Admin, Manager, Maintenance | High |
| UC-1106 | Receive Housekeeping Alert | Admin, Manager, Housekeeping | Medium |

---

## Use Case Details

### UC-001: Login to System

**Actor:** All Users  
**Preconditions:** User has valid credentials  
**Main Success Scenario:**
1. User navigates to login page
2. User enters email and password
3. System validates credentials
4. System generates JWT access token and refresh token
5. System stores refresh token in database
6. System redirects user to dashboard
7. System logs authentication event

**Alternative Flows:**
- 3a. Invalid credentials: System displays error message
- 3b. Account locked: System displays lockout message
- 3c. Account inactive: System displays inactive account message

**Postconditions:** User is authenticated and can access system

---

### UC-101: Create Guest Profile

**Actor:** Admin, Manager, Front Desk  
**Preconditions:** User is authenticated and has permission  
**Main Success Scenario:**
1. User navigates to Guests page
2. User clicks "Add Guest" button
3. User enters guest information (name, email, phone, notes)
4. System validates input (email format, required fields)
5. System checks for duplicate guests
6. System creates guest record
7. System generates guest ID
8. System logs audit event
9. System displays success message

**Alternative Flows:**
- 4a. Validation fails: System displays error messages
- 5a. Duplicate found: System suggests merge or proceed
- 6a. Database error: System displays error and logs issue

**Postconditions:** New guest profile is created and available in system

---

### UC-301: Create Reservation

**Actor:** Admin, Manager, Front Desk  
**Preconditions:** 
- User is authenticated
- Guest exists in system
- Room is available for selected dates

**Main Success Scenario:**
1. User navigates to Reservations page
2. User clicks "Add Reservation" button
3. User selects primary guest
4. User selects room
5. User enters check-in and check-out dates
6. System validates dates (check-out after check-in)
7. System checks room availability for selected dates
8. System calculates total amount (nights × price per night)
9. If double room, user optionally selects second guest
10. User selects reservation status
11. System creates reservation record
12. System updates room status if status is "Checked-in"
13. System logs audit event
14. System queues Beds24 sync job
15. System displays success message

**Alternative Flows:**
- 6a. Invalid dates: System displays error
- 7a. Room not available: System displays conflict warning
- 7b. User confirms override: System creates reservation with warning
- 9a. Double room without second guest: System prompts for confirmation
- 12a. Transaction fails: System rolls back and displays error

**Postconditions:** 
- Reservation is created
- Room availability is updated
- Beds24 sync is queued

---

### UC-305: Check-in Guest

**Actor:** Front Desk, Manager  
**Preconditions:**
- Reservation exists with status "Confirmed"
- Check-in date is today or earlier
- Room is available

**Main Success Scenario:**
1. User navigates to Reservations page
2. User finds reservation for check-in
3. User clicks "Check-in" action
4. System validates reservation status
5. System validates room availability
6. System updates reservation status to "Checked-in"
7. System updates room status to "Occupied"
8. System updates housekeeping status to "Dirty" (for future)
9. System logs audit event
10. System creates notification for housekeeping
11. System queues Beds24 sync job
12. System displays success message

**Alternative Flows:**
- 4a. Reservation already checked in: System displays message
- 5a. Room not available: System displays error
- 5b. Room requires cleaning: System prompts to mark as occupied anyway

**Postconditions:**
- Reservation status is "Checked-in"
- Room status is "Occupied"
- Housekeeping is notified

---

### UC-306: Check-out Guest

**Actor:** Front Desk, Manager  
**Preconditions:**
- Reservation exists with status "Checked-in"
- Check-out date is today or earlier

**Main Success Scenario:**
1. User navigates to Reservations page
2. User finds reservation for check-out
3. User clicks "Check-out" action
4. System validates reservation status
5. System updates reservation status to "Checked-out"
6. System updates room status to "Cleaning"
7. System updates housekeeping status to "Dirty"
8. System creates invoice automatically
9. System logs audit event
10. System creates notification for housekeeping
11. System queues Beds24 sync job
12. System displays success message with invoice details

**Alternative Flows:**
- 4a. Reservation not checked in: System displays error
- 8a. Invoice creation fails: System logs error but continues check-out

**Postconditions:**
- Reservation status is "Checked-out"
- Room status is "Cleaning"
- Invoice is created
- Housekeeping is notified

---

### UC-401: Create Invoice

**Actor:** Admin, Manager  
**Preconditions:**
- Reservation exists
- Guest exists in system

**Main Success Scenario:**
1. User navigates to Invoices page or Reservation details
2. User clicks "Create Invoice" button
3. System retrieves reservation details
4. System calculates invoice amount from reservation
5. System sets issue date to today
6. System sets due date to 30 days from today
7. User can modify amount if needed
8. User adds optional notes
9. System creates invoice record with status "Pending"
10. System links invoice to reservation and guest
11. System logs audit event
12. System displays success message

**Alternative Flows:**
- 3a. Reservation not found: System displays error
- 4a. Amount is zero: System prompts for confirmation

**Postconditions:** Invoice is created and linked to reservation

---

### UC-405: Mark Invoice as Paid

**Actor:** Admin, Manager  
**Preconditions:**
- Invoice exists with status "Pending"

**Main Success Scenario:**
1. User navigates to Invoices page
2. User finds invoice to mark as paid
3. User clicks "Mark Paid" action
4. System displays payment method selection modal
5. User selects payment method (Cash, Card, Online)
6. User confirms payment
7. System updates invoice status to "Paid"
8. System records payment method
9. System logs audit event
10. System updates financial reports
11. System displays success message

**Alternative Flows:**
- 5a. Payment method not selected: System prompts for selection

**Postconditions:** Invoice status is "Paid" and payment is recorded

---

### UC-601: Create Maintenance Request

**Actor:** Admin, Manager, Front Desk, Maintenance  
**Preconditions:**
- Room exists in system
- User is authenticated

**Main Success Scenario:**
1. User navigates to Maintenance page
2. User clicks "New Request" button
3. User selects room
4. User enters title and description
5. User selects priority (Low, Medium, High, Urgent)
6. System validates input
7. System creates maintenance request with status "Open"
8. System links request to room
9. System logs audit event
10. System creates notification for maintenance staff
11. System displays success message

**Alternative Flows:**
- 3a. Room not found: System displays error
- 6a. Validation fails: System displays error messages

**Postconditions:** Maintenance request is created and maintenance staff is notified

---

### UC-801: View Dashboard

**Actor:** All (with permissions)  
**Preconditions:** User is authenticated  
**Main Success Scenario:**
1. User logs into system
2. System displays dashboard
3. System loads real-time statistics:
   - Total rooms, occupied rooms, available rooms
   - Today's check-ins and check-outs
   - Today's revenue
   - Total revenue, expenses, profit
   - Cancellation rate
4. System displays charts:
   - Reservations by status (pie chart)
   - Revenue per month (bar chart)
   - Occupancy forecast (line chart)
5. User can interact with charts
6. User can navigate to detailed pages

**Alternative Flows:**
- 3a. No data available: System displays empty state messages

**Postconditions:** User views dashboard with current data

---

### UC-1001: Sync Reservations to Beds24

**Actor:** System (Automated)  
**Preconditions:**
- Beds24 integration is configured
- Reservation is created or updated locally

**Main Success Scenario:**
1. System detects local reservation change
2. System queues sync job in Redis
3. Background worker picks up job
4. Worker calls Beds24 API with reservation data
5. Beds24 API responds with success
6. System updates sync status to "Synced"
7. System logs sync event

**Alternative Flows:**
- 4a. Beds24 API error: System retries with exponential backoff
- 4b. Max retries exceeded: System marks as "Sync Failed" and alerts admin
- 5a. Conflict detected: System creates conflict record for manual resolution

**Postconditions:** Reservation is synced to Beds24

---

## Non-Functional Requirements

### Performance
- Dashboard should load within 2 seconds
- Search operations should complete within 1 second
- API responses should be under 500ms for standard operations
- System should support 100+ concurrent users

### Security
- All passwords must be hashed using bcrypt
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- All API endpoints require authentication
- Role-based access control enforced
- Audit logs for all data modifications
- SQL injection prevention via parameterized queries

### Reliability
- System uptime target: 99.9%
- Database transactions for data integrity
- Retry mechanism for external API calls
- Graceful error handling
- Data backup daily

### Scalability
- Horizontal scaling support (stateless API)
- Database read replicas for reporting
- Redis for caching and job queues
- Connection pooling for database

### Usability
- Responsive design for mobile and desktop
- Intuitive navigation
- Real-time notifications
- Clear error messages
- Help documentation

### Compliance
- GDPR compliance for guest data
- Audit trail retention: 7 years
- Data encryption at rest and in transit
- Regular security audits

---

## Appendix

### Glossary

- **PMS:** Property Management System
- **OTA:** Online Travel Agency
- **RBAC:** Role-Based Access Control
- **JWT:** JSON Web Token
- **API:** Application Programming Interface
- **UUID:** Universally Unique Identifier

### Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DATABASE.md](../backend/DATABASE.md) - Database documentation
- ERD Diagram - Entity Relationship Diagram
- Database Schema Diagram

---

**Document End**

