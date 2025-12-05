import { useState, useMemo } from 'react'
import { format, parseISO, compareAsc } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import SearchInput from '../components/SearchInput'
import FilterSelect from '../components/FilterSelect'
import reservationsData from '../data/reservations.json'

const ReservationsPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('checkIn')

  const filteredAndSortedReservations = useMemo(() => {
    let filtered = reservationsData.filter((res) => {
      const matchesSearch =
        res.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = !statusFilter || res.status === statusFilter
      return matchesSearch && matchesStatus
    })

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'checkIn') {
        return compareAsc(parseISO(a.checkIn), parseISO(b.checkIn))
      } else if (sortBy === 'checkOut') {
        return compareAsc(parseISO(a.checkOut), parseISO(b.checkOut))
      } else if (sortBy === 'guestName') {
        return a.guestName.localeCompare(b.guestName)
      }
      return 0
    })

    return filtered
  }, [searchTerm, statusFilter, sortBy])

  const statusOptions = [
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'Checked-in', label: 'Checked-in' },
    { value: 'Checked-out', label: 'Checked-out' },
    { value: 'Cancelled', label: 'Cancelled' },
  ]

  const sortOptions = [
    { value: 'checkIn', label: 'Check-in Date' },
    { value: 'checkOut', label: 'Check-out Date' },
    { value: 'guestName', label: 'Guest Name' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reservations</h1>
        <p className="text-gray-600 mt-2">View and manage all hotel reservations</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by guest, room, or ID..."
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="All Statuses"
            label="Status"
          />
          <FilterSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            placeholder="Sort by..."
            label="Sort By"
          />
        </div>
      </div>

      {/* Reservations Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reservation ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{reservation.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{reservation.guestName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{reservation.roomNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(parseISO(reservation.checkIn), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(parseISO(reservation.checkOut), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={reservation.status} type="reservation" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${reservation.totalAmount?.toLocaleString() || '0'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedReservations.length === 0 && (
            <div className="text-center py-12 text-gray-500">No reservations found</div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredAndSortedReservations.length} of {reservationsData.length} reservations
      </div>
    </div>
  )
}

export default ReservationsPage

