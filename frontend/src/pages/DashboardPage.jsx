import { useMemo, useEffect, useState, useCallback } from 'react'
import StatCard from '../components/StatCard'
import { api } from '../utils/api.js'
import useAuthStore from '../store/authStore.js'
import useReservationsStore from '../store/reservationsStore.js'
import useInvoicesStore from '../store/invoicesStore.js'
import useExpensesStore from '../store/expensesStore.js'
import useCheckInsStore from '../store/checkInsStore.js'
import { subscribeDashboardMetricsChanged } from '../utils/dashboardMetricsEvents.js'
import { format, eachDayOfInterval, addDays, getMonth, getYear } from 'date-fns'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'

const DashboardPage = () => {
  const activeHotelId = useAuthStore((s) => s.activeHotelId)
  const { reservations, fetchReservations, loading: reservationsLoading } = useReservationsStore()
  const { invoices, fetchInvoices, loading: invoicesLoading } = useInvoicesStore()
  const { expenses, fetchExpenses, loading: expensesLoading } = useExpensesStore()
  const { checkIns, fetchCheckIns, activeCheckIns, loading: checkInsLoading } = useCheckInsStore()
  
  const [roomTypes, setRoomTypes] = useState([])
  const [reportStats, setReportStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPartiallyStale, setIsPartiallyStale] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      setStatsLoading(true)
      setError(null)

      // Fetch all dashboard data in parallel
      const results = await Promise.allSettled([
        api.roomTypes.getAll(),
        fetchReservations(),
        fetchInvoices(),
        fetchExpenses(),
        fetchCheckIns(),
        api.reports.getStats(),
      ])

      // Check for errors
      const errors = results.filter((r) => r.status === 'rejected')
      if (errors.length > 0) {
        console.error('Some dashboard fetches failed:', errors)
      }
      setIsPartiallyStale(errors.length > 0)

      // Set room types if successful
      if (results[0].status === 'fulfilled') {
        setRoomTypes(results[0].value || [])
      }

      // Set report stats if successful
      if (results[5].status === 'fulfilled') {
        setReportStats(results[5].value)
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(err.message || 'Failed to load dashboard statistics')
    } finally {
      setStatsLoading(false)
    }
  }, [fetchReservations, fetchInvoices, fetchExpenses, fetchCheckIns])

  useEffect(() => {
    fetchDashboardData()

    // Keep operational metrics fresh while dashboard is open.
    const intervalId = setInterval(() => {
      fetchDashboardData()
    }, 60_000)

    return () => clearInterval(intervalId)
  }, [activeHotelId, fetchDashboardData])

  useEffect(() => {
    const unsubscribe = subscribeDashboardMetricsChanged(() => {
      fetchDashboardData()
    })

    return unsubscribe
  }, [fetchDashboardData])

  const loading = statsLoading || reservationsLoading || invoicesLoading || expensesLoading || checkInsLoading

  // Calculate stats from backend data and check-ins
  const stats = useMemo(() => {
    // Calculate total rooms from room types (sum of qty for each room type)
    const localTotalRooms = roomTypes.reduce((sum, rt) => sum + (parseInt(rt.qty, 10) || 0), 0)
    
    // Calculate occupied rooms from active check-ins
    const localOccupiedRooms = activeCheckIns.length

    const backendTotalRooms = Number(reportStats?.occupancy?.total_units)
    const backendOccupiedRooms = Number(reportStats?.occupancy?.current_occupied_units)

    const totalRooms = Number.isFinite(backendTotalRooms) ? backendTotalRooms : localTotalRooms
    const occupiedRooms = Number.isFinite(backendOccupiedRooms) ? backendOccupiedRooms : localOccupiedRooms
    
    const availableRooms = Math.max(0, totalRooms - occupiedRooms)

    // Calculate today's check-ins and check-outs
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = reportStats?.meta?.business_date || today.toISOString().split('T')[0]
    
    const localTodaysCheckInsCount = checkIns.filter((ci) => {
      if (!ci.check_in_time) return false
      const checkInDate = ci.check_in_time.split('T')[0]
      return checkInDate === todayStr
    }).length

    const localTodaysCheckOutsCount = checkIns.filter((ci) => {
      if (!ci.actual_checkout_time) return false
      const checkOutDate = ci.actual_checkout_time.split('T')[0]
      return checkOutDate === todayStr
    }).length

    // Calculate today's revenue from invoices issued today
    const localTodaysRevenue = invoices
      .filter((inv) => {
        const issueDate = inv.issueDate ? inv.issueDate.split('T')[0] : null
        return issueDate === todayStr && inv.status === 'Paid'
      })
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

    const todaysCheckIns = Number(reportStats?.reservations?.today_check_ins)
    const todaysCheckOuts = Number(reportStats?.reservations?.today_check_outs)
    const todaysRevenue = Number(reportStats?.financial?.today_revenue)

    return {
      totalRooms,
      occupiedRooms,
      availableRooms,
      activeCheckIns: activeCheckIns.length,
      todaysCheckIns: Number.isFinite(todaysCheckIns) ? todaysCheckIns : localTodaysCheckInsCount,
      todaysCheckOuts: Number.isFinite(todaysCheckOuts) ? todaysCheckOuts : localTodaysCheckOutsCount,
      todaysRevenue: Number.isFinite(todaysRevenue) ? todaysRevenue : localTodaysRevenue,
    }
  }, [roomTypes, invoices, checkIns, activeCheckIns, reportStats])

  // Financial calculations from backend stats (always use backend data)
  const financialStats = useMemo(() => {
    if (reportStats?.financial) {
      return {
        totalRevenue: Number(reportStats.financial.total_revenue) || 0,
        totalExpenses: Number(reportStats.financial.total_expenses) || 0,
        profit: Number(reportStats.financial.profit) || 0,
      }
    }

    // Fallback to local calculations if backend data not available
    const totalRevenue = invoices
      .filter((inv) => inv.status === 'Paid')
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

    const totalExpensesAmount = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
    const profit = totalRevenue - totalExpensesAmount

    return {
      totalRevenue,
      totalExpenses: totalExpensesAmount,
      profit,
    }
  }, [reportStats, invoices, expenses])

  // Cancellation rate from backend stats
  const cancellationRate = useMemo(() => {
    if (reportStats?.reservations) {
      const backendRate = Number(reportStats.reservations.cancellation_rate)
      if (Number.isFinite(backendRate)) return backendRate
      const total = reportStats.reservations.total || 0
      const cancelled = reportStats.reservations.by_status?.Cancelled || 0
      return total > 0 ? (cancelled / total) * 100 : 0
    }

    // Fallback to local calculation
    if (reservations.length === 0) return 0
    const cancelledCount = reservations.filter((res) => res.status === 'Cancelled').length
    return (cancelledCount / reservations.length) * 100
  }, [reportStats, reservations])

  // Chart data: Reservations by Status (Pie Chart)
  const reservationStatusData = useMemo(() => {
    const COLORS = {
      'Confirmed': '#3b82f6',
      'Checked-in': '#10b981',
      'Checked-out': '#6b7280',
      'Cancelled': '#ef4444',
    }

    // Use backend stats if available
    if (reportStats?.reservations?.by_status) {
      return Object.entries(reportStats.reservations.by_status).map(([name, value]) => ({
        name,
        value: Number(value) || 0,
        color: COLORS[name] || '#9ca3af',
      }))
    }

    // Fallback to local data
    const statusCounts = reservations.reduce((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1
      return acc
    }, {})

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: COLORS[name] || '#9ca3af',
    }))
  }, [reportStats, reservations])

  // Chart data: Revenue per Month (Bar Chart) based on invoices
  const revenueByMonthData = useMemo(() => {
    const monthRevenue = {}
    
    invoices
      .filter((inv) => inv.status === 'Paid' && inv.issueDate)
      .forEach((inv) => {
        try {
          // Parse date string directly without parseISO to avoid timezone issues
          const dateStr = inv.issueDate.split('T')[0]
          const [year, month] = dateStr.split('-')
          const monthKey = `${year}-${month}`
          monthRevenue[monthKey] = (monthRevenue[monthKey] || 0) + (parseFloat(inv.amount) || 0)
        } catch (e) {
          // Skip invalid dates
          console.warn('Invalid date in invoice:', inv.issueDate)
        }
      })

    // Get last 6 months
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const month = getMonth(date) + 1
      const monthKey = `${getYear(date)}-${String(month).padStart(2, '0')}`
      months.push({
        month: format(date, 'MMM yyyy'),
        revenue: monthRevenue[monthKey] || 0,
      })
    }

    return months
  }, [invoices])

  // Chart data: Occupancy over next 30 days (Line Chart)
  const occupancyData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next30Days = eachDayOfInterval({
      start: today,
      end: addDays(today, 30),
    })

    return next30Days.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const occupiedCount = reservations.filter((res) => {
        if (res.status === 'Cancelled' || !res.checkIn || !res.checkOut) return false
        try {
          // Use string comparison for dates to avoid timezone issues
          const checkIn = res.checkIn.split('T')[0]
          const checkOut = res.checkOut.split('T')[0]
          return checkIn <= dateStr && checkOut > dateStr
        } catch (e) {
          return false
        }
      }).length

      return {
        date: format(date, 'MMM dd'),
        occupied: occupiedCount,
      }
    })
  }, [reservations])

  const COLORS = ['#3b82f6', '#10b981', '#6b7280', '#ef4444', '#f59e0b']

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your hotel.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400">Loading dashboard data...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your hotel.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="text-red-600">Error: {error}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Welcome back! Here's an overview of your hotel.</p>
      </div>

      {isPartiallyStale && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          Some metrics are using fallback/local data because one or more dashboard sources could not be refreshed.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Rooms"
          value={stats.totalRooms}
          icon={<span className="text-2xl">🛏️</span>}
        />
        <StatCard
          title="Occupied Rooms"
          value={stats.occupiedRooms}
          icon={<span className="text-2xl">🔴</span>}
        />
        <StatCard
          title="Available Rooms"
          value={stats.availableRooms}
          icon={<span className="text-2xl">🟢</span>}
        />
        <StatCard
          title="Active Check-ins"
          value={stats.activeCheckIns}
          icon={<span className="text-2xl">🔑</span>}
        />
        <StatCard
          title="Today's Check-ins"
          value={stats.todaysCheckIns}
          icon={<span className="text-2xl">📥</span>}
        />
        <StatCard
          title="Today's Check-outs"
          value={stats.todaysCheckOuts}
          icon={<span className="text-2xl">📤</span>}
        />
        <StatCard
          title="Today's Revenue"
          value={`$${stats.todaysRevenue.toLocaleString()}`}
          icon={<span className="text-2xl">💰</span>}
        />
        <StatCard
          title="Total Revenue"
          value={`$${financialStats.totalRevenue.toLocaleString()}`}
          icon={<span className="text-2xl">💵</span>}
        />
        <StatCard
          title="Total Expenses"
          value={`$${financialStats.totalExpenses.toLocaleString()}`}
          icon={<span className="text-2xl">📉</span>}
        />
        <StatCard
          title="Profit"
          value={`$${financialStats.profit.toLocaleString()}`}
          icon={<span className="text-2xl">📊</span>}
          className={financialStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          title="Cancellation Rate"
          value={`${cancellationRate.toFixed(1)}%`}
          icon={<span className="text-2xl">❌</span>}
        />
        {reportStats?.occupancy && (
          <>
            <StatCard
              title="Current Occupancy Rate"
              value={`${Number(reportStats.occupancy.current_occupancy_rate || 0).toFixed(1)}%`}
              icon={<span className="text-2xl">📈</span>}
            />
            <StatCard
              title="Average Occupancy (30 days)"
              value={`${Number(reportStats.occupancy.average_occupancy_rate || 0).toFixed(1)}%`}
              icon={<span className="text-2xl">📊</span>}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Reservations by Status - Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Reservations by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reservationStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {reservationStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue per Month - Bar Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue per Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Occupancy Chart - Full Width */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Occupancy Over Next 30 Days</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={occupancyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="occupied" stroke="#10b981" name="Rooms Occupied" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Advanced Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Cancellation Rate Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Cancellation Rate</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[{ period: 'Current period', rate: cancellationRate }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Bar dataKey="rate" fill="#ef4444" name="Cancellation %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage

