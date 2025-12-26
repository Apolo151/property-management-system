import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval, isSameDay } from 'date-fns'
import useReservationsStore from '../store/reservationsStore'
import useRoomsStore from '../store/roomsStore'
import useGuestsStore from '../store/guestsStore'
import GuestSelect from './GuestSelect'
import Modal from './Modal'

const BookingTimeline = () => {
  const { reservations, fetchReservations, createReservation } = useReservationsStore()
  const { rooms, fetchRooms } = useRoomsStore()
  const { guests, fetchGuests } = useGuestsStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newReservation, setNewReservation] = useState({
    guestId: '',
    guest2Id: '',
    roomNumber: '',
    checkIn: '',
    checkOut: '',
    status: 'Confirmed',
  })

  // Fetch data on mount
  useEffect(() => {
    fetchReservations()
    fetchRooms()
    fetchGuests()
  }, [fetchReservations, fetchRooms, fetchGuests])

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getReservationsForRoom = (roomNumber) => {
    return reservations.filter(
      (res) => res.roomNumber === roomNumber && res.status !== 'Cancelled'
    )
  }

  const getReservationForSlot = (roomNumber, date) => {
    return reservations.find((res) => {
      if (res.roomNumber !== roomNumber || res.status === 'Cancelled') return false
      const checkIn = parseISO(res.checkIn)
      const checkOut = parseISO(res.checkOut)
      return isWithinInterval(date, { start: checkIn, end: checkOut })
    })
  }

  const handleSlotDoubleClick = (room, date) => {
    setSelectedSlot({ room, date })
    setNewReservation({
      guestId: '',
      guest2Id: '',
      roomNumber: room.roomNumber,
      checkIn: format(date, 'yyyy-MM-dd'),
      checkOut: format(addDays(date, 1), 'yyyy-MM-dd'),
      status: 'Confirmed',
    })
    setIsModalOpen(true)
  }

  const handleCreateReservation = async () => {
    if (!newReservation.guestId || !newReservation.roomNumber || !newReservation.checkIn || !newReservation.checkOut) {
      alert('Please fill in all required fields')
      return
    }

    const checkInDate = parseISO(newReservation.checkIn)
    const checkOutDate = parseISO(newReservation.checkOut)

    if (checkOutDate <= checkInDate) {
      alert('Check-out date must be after check-in date')
      return
    }

    const room = rooms.find((r) => r.roomNumber === newReservation.roomNumber)
    const guest = guests.find((g) => String(g.id) === String(newReservation.guestId))
    const guest2 = newReservation.guest2Id ? guests.find((g) => String(g.id) === String(newReservation.guest2Id)) : null

    if (!room) {
      alert('Room not found')
      return
    }

    if (!guest) {
      alert('Guest not found')
      return
    }

    // Check for overlapping reservations
    const hasOverlap = reservations.some((res) => {
      if (res.roomNumber !== newReservation.roomNumber || res.status === 'Cancelled') return false
      const resCheckIn = parseISO(res.checkIn)
      const resCheckOut = parseISO(res.checkOut)
      return (
        (checkInDate >= resCheckIn && checkInDate < resCheckOut) ||
        (checkOutDate > resCheckIn && checkOutDate <= resCheckOut) ||
        (checkInDate <= resCheckIn && checkOutDate >= resCheckOut)
      )
    })

    let force = false
    if (hasOverlap) {
      if (!confirm('Room already has a reservation during this period. Continue anyway?')) {
        return
      }
      force = true
    }

    try {
      await createReservation({
        roomId: room.id,
        guestId: String(guest.id),
        guest2Id: guest2 ? String(guest2.id) : undefined,
        checkIn: newReservation.checkIn,
        checkOut: newReservation.checkOut,
        status: newReservation.status,
        force,
      })

      setIsModalOpen(false)
      setNewReservation({ guestId: '', guest2Id: '', roomNumber: '', checkIn: '', checkOut: '', status: 'Confirmed' })
      setSelectedSlot(null)
    } catch (error) {
      alert(error.message || 'Failed to create reservation')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-blue-500'
      case 'Checked-in':
        return 'bg-green-500'
      case 'Checked-out':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const prevWeek = () => {
    setCurrentDate(addDays(currentDate, -7))
  }

  const nextWeek = () => {
    setCurrentDate(addDays(currentDate, 7))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Booking Timeline</h2>
          <p className="text-gray-600 mt-1">Double-click on empty slots to create reservations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevWeek} className="btn btn-secondary">
            ← Previous Week
          </button>
          <button onClick={nextWeek} className="btn btn-secondary">
            Next Week →
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-full">
          {/* Header with dates */}
          <div className="flex border-b">
            <div className="w-48 p-3 font-semibold text-gray-700 border-r sticky left-0 bg-white z-10">
              Room
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-[120px] p-3 text-center border-r last:border-r-0"
              >
                <div className="text-sm font-medium text-gray-700">
                  {format(day, 'EEE')}
                </div>
                <div className="text-xs text-gray-500">{format(day, 'MMM dd')}</div>
              </div>
            ))}
          </div>

          {/* Rows for each room */}
          {rooms.map((room) => {
            const roomReservations = getReservationsForRoom(room.roomNumber)

            return (
              <div key={room.id} className="flex border-b last:border-b-0 hover:bg-gray-50">
                {/* Room name column */}
                <div className="w-48 p-3 border-r sticky left-0 bg-white z-10">
                  <div className="font-medium text-gray-900">{room.roomNumber}</div>
                  <div className="text-xs text-gray-500">{room.type}</div>
                </div>

                {/* Day cells */}
                {days.map((day) => {
                  const reservation = getReservationForSlot(room.roomNumber, day)
                  const isCheckIn = reservation && isSameDay(parseISO(reservation.checkIn), day)
                  const isCheckOut = reservation && isSameDay(parseISO(reservation.checkOut), day)

                  return (
                    <div
                      key={day.toISOString()}
                      className="flex-1 min-w-[120px] border-r last:border-r-0 relative"
                      onDoubleClick={() => !reservation && handleSlotDoubleClick(room, day)}
                      style={{ cursor: reservation ? 'default' : 'pointer' }}
                    >
                      {reservation ? (
                        <div
                          className={`h-full p-2 text-white text-xs ${getStatusColor(
                            reservation.status
                          )} flex items-center justify-between`}
                          title={`${reservation.guestName} - ${reservation.id}`}
                        >
                          <span className="truncate">{reservation.guestName}</span>
                          {isCheckIn && <span className="ml-1">📥</span>}
                          {isCheckOut && <span className="ml-1">📤</span>}
                        </div>
                      ) : (
                        <div className="h-full p-2 hover:bg-blue-50 transition-colors">
                          <div className="text-xs text-gray-400 text-center">Available</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card mt-4">
        <h3 className="font-semibold mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm">Checked-in</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-500 rounded"></div>
            <span className="text-sm">Checked-out</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-gray-300 rounded"></div>
            <span className="text-sm">Available (double-click to book)</span>
          </div>
        </div>
      </div>

      {/* Create Reservation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setNewReservation({ guestId: '', guest2Id: '', roomNumber: '', checkIn: '', checkOut: '', status: 'Confirmed' })
          setSelectedSlot(null)
        }}
        title="Create Reservation"
      >
        <div className="space-y-4">
          <GuestSelect
            value={newReservation.guestId}
            onChange={(guestId) => setNewReservation({ ...newReservation, guestId })}
            guests={guests}
            label="Primary Guest"
            placeholder="Search for a guest by name, email, or phone..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
            <input
              type="text"
              value={newReservation.roomNumber}
              disabled
              className="input bg-gray-50"
            />
          </div>
          {newReservation.roomNumber && (() => {
            const selectedRoom = rooms.find((r) => r.roomNumber === newReservation.roomNumber)
            return selectedRoom && selectedRoom.type === 'Double' ? (
              <GuestSelect
                value={newReservation.guest2Id}
                onChange={(guest2Id) => setNewReservation({ ...newReservation, guest2Id })}
                guests={guests.filter((g) => String(g.id) !== String(newReservation.guestId))}
                label="Second Guest (Optional)"
                placeholder="Search for a second guest by name, email, or phone..."
              />
            ) : null
          })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date *</label>
            <input
              type="date"
              value={newReservation.checkIn}
              onChange={(e) =>
                setNewReservation({ ...newReservation, checkIn: e.target.value })
              }
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date *</label>
            <input
              type="date"
              value={newReservation.checkOut}
              onChange={(e) =>
                setNewReservation({ ...newReservation, checkOut: e.target.value })
              }
              min={newReservation.checkIn}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={newReservation.status}
              onChange={(e) =>
                setNewReservation({ ...newReservation, status: e.target.value })
              }
              className="input"
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Checked-in">Checked-in</option>
              <option value="Checked-out">Checked-out</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setNewReservation({ guestId: '', guest2Id: '', roomNumber: '', checkIn: '', checkOut: '', status: 'Confirmed' })
                setSelectedSlot(null)
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleCreateReservation} className="btn btn-primary">
              Create Reservation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default BookingTimeline

