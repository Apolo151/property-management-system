import type { Request, Response, NextFunction } from 'express';
import db from '../../config/database.js';
import type { ReportStatsResponse } from './reports_types.js';

// Get comprehensive report statistics
export async function getReportStatsHandler(
  req: Request,
  res: Response<ReportStatsResponse>,
  next: NextFunction,
) {
  try {
    const { start_date, end_date } = req.query;
    const hotelId = (req as any).hotelId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    const next7DaysStr = next7Days.toISOString().split('T')[0];

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

    const todaysCheckIns = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_in = ?', [todayStr as any])
      .whereIn('status', ['Confirmed', 'Checked-in'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    const todaysCheckOuts = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_out = ?', [todayStr as any])
      .whereIn('status', ['Checked-in', 'Checked-out'])
      .whereNull('deleted_at')
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

    // Financial calculations
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Occupancy statistics - use room_types with qty for total rooms count
    const totalRoomsResult = await db('room_types')
      .where('room_types.hotel_id', hotelId)
      .whereNull('deleted_at')
      .sum('qty as total');
    const totalRoomsCount = totalRoomsResult?.[0]?.total ? parseInt(String(totalRoomsResult[0].total), 10) : 0;

    // Count occupied rooms from checked-in reservations
    const occupiedRooms = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_in <= ?', [todayStr as any])
      .whereRaw('check_out > ?', [todayStr as any])
      .whereIn('status', ['Checked-in'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    const occupiedRoomsCount = occupiedRooms?.count ? parseInt(String(occupiedRooms.count), 10) : 0;
    const currentOccupancyRate = totalRoomsCount > 0 ? (occupiedRoomsCount / totalRoomsCount) * 100 : 0;

    // Average occupancy for last 30 days
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const last30DaysStr = last30Days.toISOString().split('T')[0];

    const reservationsLast30Days = await db('reservations')
      .where('reservations.hotel_id', hotelId)
      .whereRaw('check_in >= ?', [last30DaysStr as any])
      .whereRaw('check_in <= ?', [todayStr as any])
      .whereIn('status', ['Checked-in', 'Checked-out'])
      .whereNull('deleted_at');

    // Calculate average occupancy (simplified - count of check-ins / days)
    const averageOccupancyRate = totalRoomsCount > 0
      ? ((reservationsLast30Days.length / 30) / totalRoomsCount) * 100
      : 0;

    const response: ReportStatsResponse = {
      reservations: {
        total: allReservations.length,
        by_status: reservationsByStatus,
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
        total_expenses: totalExpenses,
        profit: profit,
        profit_margin: profitMargin,
      },
      occupancy: {
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

