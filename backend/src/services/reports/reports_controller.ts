import type { Request, Response, NextFunction } from 'express';
import db from '../../config/database.js';
import type { ReportStatsResponse } from './reports_types.js';
import { getHotelTimezone, getLocalDateStringForTimezone } from '../../utils/hotel_date.js';

// Get comprehensive report statistics
export async function getReportStatsHandler(
  req: Request,
  res: Response<ReportStatsResponse>,
  next: NextFunction,
) {
  try {
    const { start_date, end_date } = req.query;
    const hotelId = (req as any).hotelId;

    const hotelTimezone = await getHotelTimezone(db, hotelId);
    const todayStr = getLocalDateStringForTimezone(new Date(), hotelTimezone);

    const addDaysToDateString = (dateString: string, days: number): string => {
      const parts = dateString.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      const shifted = new Date(Date.UTC(year, month - 1, day + days));
      const yyyy = shifted.getUTCFullYear();
      const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(shifted.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const next7DaysStr = addDaysToDateString(todayStr, 7);

    // Reservations statistics
    let reservationsQuery = db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereNull('deleted_at');
    if (start_date) {
      reservationsQuery = reservationsQuery.whereRaw('check_in >= ?', [start_date as string]);
    }
    if (end_date) {
      reservationsQuery = reservationsQuery.whereRaw('check_out <= ?', [end_date as string]);
    }

    const allReservations = await reservationsQuery;
    const reservationsByStatus: Record<string, number> = {};
    allReservations.forEach((res) => {
      reservationsByStatus[res.status] = (reservationsByStatus[res.status] || 0) + 1;
    });

    const todaysCheckIns = await db('check_ins')
      .where('check_ins.hotel_id', hotelId)
      .whereRaw("DATE(check_in_time AT TIME ZONE ?) = ?", [hotelTimezone, todayStr])
      .count('* as count')
      .first();

    const todaysCheckOuts = await db('check_ins')
      .where('check_ins.hotel_id', hotelId)
      .whereNotNull('actual_checkout_time')
      .whereRaw("DATE(actual_checkout_time AT TIME ZONE ?) = ?", [hotelTimezone, todayStr])
      .count('* as count')
      .first();

    const upcomingCheckIns = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_in > ?', [todayStr as any])
      .whereRaw('check_in <= ?', [next7DaysStr as any])
      .whereIn('status', ['Confirmed'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    const upcomingCheckOuts = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_out > ?', [todayStr as any])
      .whereRaw('check_out <= ?', [next7DaysStr as any])
      .whereIn('status', ['Checked-in'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    // Guests statistics
    let guestsQuery = db('guests')
      .where('guests.hotel_id', hotelId)
      .whereNull('deleted_at');
    const allGuests = await guestsQuery;
    const guestsWithPastStays = allGuests.filter((g) => (g.past_stays || 0) > 0).length;
    const newGuests = allGuests.filter((g) => (g.past_stays || 0) === 0).length;

    // Invoices statistics
    let invoicesQuery = db('invoices')
      .where('invoices.hotel_id', hotelId)
      .whereNull('deleted_at');
    if (start_date) {
      invoicesQuery = invoicesQuery.whereRaw('issue_date >= ?', [start_date as string]);
    }
    if (end_date) {
      invoicesQuery = invoicesQuery.whereRaw('issue_date <= ?', [end_date as string]);
    }

    const allInvoices = await invoicesQuery;
    const invoicesByStatus: Record<string, number> = {};
    let totalRevenue = 0;
    let pendingAmount = 0;

    allInvoices.forEach((inv) => {
      invoicesByStatus[inv.status] = (invoicesByStatus[inv.status] || 0) + 1;
      if (inv.status === 'Paid') {
        totalRevenue += parseFloat(inv.amount);
      } else if (inv.status === 'Pending') {
        pendingAmount += parseFloat(inv.amount);
      }
    });

    totalRevenue = Math.max(0, totalRevenue);
    pendingAmount = Math.max(0, pendingAmount);

    const todayRevenue = allInvoices
      .filter((inv) => inv.status === 'Paid' && String(inv.issue_date) === todayStr)
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    const overdueInvoices = await db('invoices')
      .where('invoices.hotel_id', hotelId)
      .where('status', 'Pending')
      .whereRaw('due_date < ?', [todayStr as any])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    // Expenses statistics
    let expensesQuery = db('expenses')
      .where('expenses.hotel_id', hotelId)
      .whereNull('deleted_at');
    if (start_date) {
      expensesQuery = expensesQuery.whereRaw('expense_date >= ?', [start_date as string]);
    }
    if (end_date) {
      expensesQuery = expensesQuery.whereRaw('expense_date <= ?', [end_date as string]);
    }

    const allExpenses = await expensesQuery;
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;

    allExpenses.forEach((exp) => {
      expensesByCategory[exp.category] =
        (expensesByCategory[exp.category] || 0) + parseFloat(exp.amount);
      totalExpenses += parseFloat(exp.amount);
    });

    totalExpenses = Math.max(0, totalExpenses);

    // Financial calculations
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Occupancy statistics - use room_types with qty for total rooms count
    const totalRoomsResult = await db('room_types')
      .where('room_types.hotel_id', hotelId)
      .whereNull('deleted_at')
      .sum('qty as total');
    const totalRoomsCount = totalRoomsResult?.[0]?.total ? parseInt(String(totalRoomsResult[0].total), 10) : 0;

    // Count occupied rooms from active check-ins
    const occupiedRooms = await db('check_ins')
      .join('reservations', 'reservations.id', 'check_ins.reservation_id')
      .where('check_ins.hotel_id', hotelId)
      .where('check_ins.status', 'checked_in')
      .whereNull('reservations.deleted_at')
      .sum('reservations.units_requested as occupied_units')
      .first();

    const occupiedUnitsCount = occupiedRooms?.occupied_units
      ? parseInt(String(occupiedRooms.occupied_units), 10)
      : 0;
    const safeOccupiedUnitsCount = Math.max(0, occupiedUnitsCount);
    const safeTotalRoomsCount = Math.max(0, totalRoomsCount);
    const currentOccupancyRate = totalRoomsCount > 0
      ? (safeOccupiedUnitsCount / safeTotalRoomsCount) * 100
      : 0;

    // Average occupancy for last 30 days
    const occupancyDays = 30;
    const periodStartStr = addDaysToDateString(todayStr, -(occupancyDays - 1));
    const tomorrowStr = addDaysToDateString(todayStr, 1);

    const reservationsForOccupancy = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_in < ?', [tomorrowStr])
      .whereRaw('check_out > ?', [periodStartStr])
      .whereNotIn('status', ['Cancelled', 'No-show'])
      .whereNull('deleted_at')
      .select('check_in', 'check_out', 'units_requested');

    const parseDateOnlyUtc = (value: string): Date => {
      const parts = value.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      return new Date(Date.UTC(year, month - 1, day));
    };

    const windowStart = parseDateOnlyUtc(periodStartStr);
    const windowEnd = parseDateOnlyUtc(tomorrowStr);

    const occupiedRoomNights = reservationsForOccupancy.reduce((sum, reservation) => {
      const checkInDate = parseDateOnlyUtc(String(reservation.check_in));
      const checkOutDate = parseDateOnlyUtc(String(reservation.check_out));

      const overlapStart = checkInDate > windowStart ? checkInDate : windowStart;
      const overlapEnd = checkOutDate < windowEnd ? checkOutDate : windowEnd;
      const nights = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000));
      const unitsRequested = Math.max(1, Number(reservation.units_requested) || 1);

      return sum + nights * unitsRequested;
    }, 0);

    const averageOccupancyRate = totalRoomsCount > 0
      ? (occupiedRoomNights / (occupancyDays * totalRoomsCount)) * 100
      : 0;

    const totalReservations = allReservations.length;
    const cancelledReservations = reservationsByStatus.Cancelled || 0;
    const rawCancellationRate = totalReservations > 0
      ? (cancelledReservations / totalReservations) * 100
      : 0;
    const cancellationRate = Math.min(100, Math.max(0, rawCancellationRate));

    const response: ReportStatsResponse = {
      meta: {
        hotel_timezone: hotelTimezone,
        business_date: todayStr,
      },
      reservations: {
        total: allReservations.length,
        by_status: reservationsByStatus,
        cancellation_rate: cancellationRate,
        today_check_ins: todaysCheckIns?.count ? parseInt(String(todaysCheckIns.count), 10) : 0,
        today_check_outs: todaysCheckOuts?.count ? parseInt(String(todaysCheckOuts.count), 10) : 0,
        upcoming_check_ins: upcomingCheckIns?.count ? parseInt(String(upcomingCheckIns.count), 10) : 0,
        upcoming_check_outs: upcomingCheckOuts?.count ? parseInt(String(upcomingCheckOuts.count), 10) : 0,
      },
      guests: {
        total: allGuests.length,
        with_past_stays: guestsWithPastStays,
        new_guests: newGuests,
      },
      invoices: {
        total: allInvoices.length,
        by_status: invoicesByStatus,
        total_revenue: totalRevenue,
        pending_amount: pendingAmount,
        overdue_count: overdueInvoices?.count ? parseInt(String(overdueInvoices.count), 10) : 0,
      },
      expenses: {
        total: allExpenses.length,
        total_amount: totalExpenses,
        by_category: expensesByCategory,
      },
      financial: {
        total_revenue: totalRevenue,
        today_revenue: todayRevenue,
        total_expenses: totalExpenses,
        profit: profit,
        profit_margin: profitMargin,
      },
      occupancy: {
        total_units: safeTotalRoomsCount,
        current_occupied_units: safeOccupiedUnitsCount,
        current_occupancy_rate: currentOccupancyRate,
        average_occupancy_rate: averageOccupancyRate,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/** UC-806: minimal CSV summary export for the same date window as stats. */
export async function exportReportsCsvHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { start_date, end_date } = req.query;
    const hotelId = (req as any).hotelId;

    let resQ = db('reservations').where('hotel_id', hotelId).whereNull('deleted_at');
    if (start_date) resQ = resQ.whereRaw('check_in >= ?', [start_date as string]);
    if (end_date) resQ = resQ.whereRaw('check_out <= ?', [end_date as string]);
    const resCount = await resQ.count('* as c').first();

    let invQ = db('invoices').where('hotel_id', hotelId).whereNull('deleted_at');
    if (start_date) invQ = invQ.whereRaw('issue_date >= ?', [start_date as string]);
    if (end_date) invQ = invQ.whereRaw('issue_date <= ?', [end_date as string]);
    const paidSum = await invQ.clone().where('status', 'Paid').sum('amount as s').first();
    const pendSum = await invQ.clone().where('status', 'Pending').sum('amount as s').first();

    let expQ = db('expenses').where('hotel_id', hotelId).whereNull('deleted_at');
    if (start_date) expQ = expQ.whereRaw('expense_date >= ?', [start_date as string]);
    if (end_date) expQ = expQ.whereRaw('expense_date <= ?', [end_date as string]);
    const expSum = await expQ.sum('amount as s').first();

    const lines = [
      'metric,value',
      `reservations_in_range,${Number((resCount as any)?.c ?? 0)}`,
      `invoices_paid_total,${parseFloat(String((paidSum as any)?.s ?? 0))}`,
      `invoices_pending_total,${parseFloat(String((pendSum as any)?.s ?? 0))}`,
      `expenses_total,${parseFloat(String((expSum as any)?.s ?? 0))}`,
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report-summary.csv"');
    res.send(lines.join('\n'));
  } catch (error) {
    next(error);
  }
}

