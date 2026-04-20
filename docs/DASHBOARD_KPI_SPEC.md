# Dashboard KPI Contract

This document freezes KPI semantics for the dashboard and defines authority, filters, time basis, and expected mutation deltas.

## Global Rules

- Backend `GET /api/v1/reports/stats` is the source of truth for business KPIs.
- Business day is property-local and exposed as:
  - `meta.hotel_timezone`
  - `meta.business_date` (`YYYY-MM-DD`)
- Frontend local calculations are resilience fallback only.
- Invariants:
  - `available_rooms = max(0, total_rooms - occupied_rooms)`
  - `0 <= cancellation_rate <= 100`
  - `profit = total_revenue - total_expenses`
  - Totals are non-negative

## KPI Table

| KPI | Formula | Tables/Fields | Status Filters | Date Basis | Timezone Basis | Authority |
|---|---|---|---|---|---|---|
| Total Rooms | sum room type qty | `room_types.qty` | active records | N/A | N/A | Frontend (from `/room-types`) |
| Occupied Rooms | active checked-in units | `check_ins.status`, `reservations.units_requested` | `check_ins.status='checked_in'` | current | hotel local | Backend-derived via reports occupancy semantics |
| Available Rooms | `max(0, total - occupied)` | derived | N/A | current | hotel local | Frontend derived |
| Active Check-ins | count active check-ins | `check_ins.status` | `checked_in` | current | hotel local | Frontend/store derived |
| Today's Check-ins | count check-ins where local event date == business date | `check_ins.check_in_time` | all check-ins | today | hotel local | Backend |
| Today's Check-outs | count check-outs where local event date == business date | `check_ins.actual_checkout_time` | checked out events | today | hotel local | Backend |
| Today's Revenue | sum paid invoices issued on business date | `invoices.amount`, `invoices.issue_date`, `invoices.status` | `Paid` | today | hotel local business date | Backend |
| Total Revenue | sum paid invoices | `invoices.amount`, `invoices.status` | `Paid` | report date window | date field (`issue_date`) | Backend |
| Total Expenses | sum expenses | `expenses.amount` | non-deleted | report date window | date field (`expense_date`) | Backend |
| Profit | `total_revenue - total_expenses` | derived | N/A | report date window | inherited | Backend |
| Cancellation Rate | `cancelled/total*100` | `reservations.status` | includes query scope | report date window | inherited | Backend |
| Current Occupancy Rate | `occupied_units/total_units*100` | `check_ins + reservations + room_types` | active checked-in | current | hotel local business date context | Backend |
| Avg Occupancy (30d) | occupied room-nights over `30*total_units` | `reservations.check_in/check_out/units_requested` | not cancelled/no-show | rolling 30 days | business date anchored | Backend |

## Expected Deltas Per Business Action

| Business Action | Expected KPI Deltas |
|---|---|
| Check in guest | `active_check_ins +1`, `occupied_rooms +units_requested`, `available_rooms -units_requested`, possibly `today_check_ins +1` |
| Check out guest | `active_check_ins -1`, `occupied_rooms -units_requested`, `available_rooms +units_requested`, possibly `today_check_outs +1`; no revenue change unless invoice is marked paid |
| Mark invoice Paid | `total_revenue +amount`, `profit +amount`; possibly `today_revenue +amount` if issue date equals business date |
| Create expense | `total_expenses +amount`, `profit -amount` |
| Update expense amount | deltas follow amount change |
| Delete expense | `total_expenses -amount`, `profit +amount` |
| Cancel reservation | `cancellation_rate` increases if in scoped dataset; occupancy projections may decrease |

## Regression Checks

- Validate all invariants on each reports response in tests.
- Validate mutation deltas before/after each business action.
- Validate timezone boundary around local midnight in at least 2 non-UTC zones.
