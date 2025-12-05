import { useMemo } from 'react'
import StatCard from '../components/StatCard'
import roomsData from '../data/rooms.json'
import reservationsData from '../data/reservations.json'
import { format, isToday, parseISO } from 'date-fns'

const DashboardPage = () => {
  const stats = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    const totalRooms = roomsData.length
    const occupiedRooms = roomsData.filter((room) => room.status === 'Occupied').length
    const availableRooms = roomsData.filter((room) => room.status === 'Available').length

    const todaysCheckIns = reservationsData.filter((res) => {
      const checkIn = parseISO(res.checkIn)
      return isToday(checkIn) && (res.status === 'Confirmed' || res.status === 'Checked-in')
    }).length

    const todaysCheckOuts = reservationsData.filter((res) => {
      const checkOut = parseISO(res.checkOut)
      return isToday(checkOut) && (res.status === 'Checked-in' || res.status === 'Checked-out')
    }).length

    const todaysRevenue = reservationsData
      .filter((res) => {
        const checkIn = parseISO(res.checkIn)
        const checkOut = parseISO(res.checkOut)
        return (
          (isToday(checkIn) || isToday(checkOut) || (checkIn <= today && checkOut >= today)) &&
          res.status !== 'Cancelled'
        )
      })
      .reduce((sum, res) => sum + (res.totalAmount || 0), 0)

    return {
      totalRooms,
      occupiedRooms,
      availableRooms,
      todaysCheckIns,
      todaysCheckOuts,
      todaysRevenue,
    }
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your hotel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>
    </div>
  )
}

export default DashboardPage

