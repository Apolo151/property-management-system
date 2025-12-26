import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import useReservationsStore from '../store/reservationsStore'
import useRoomsStore from '../store/roomsStore'
import useGuestsStore from '../store/guestsStore'
import StatusBadge from '../components/StatusBadge'
import GuestSelect from '../components/GuestSelect'
import Modal from '../components/Modal'

const AvailabilityPage = () => {
  const { createReservation, checkAvailability } = useReservationsStore()
  const { rooms, fetchRooms } = useRoomsStore()
  const { guests, fetchGuests } = useGuestsStore()
  const [checkIn, setCheckIn] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  const [roomType, setRoomType] = useState('')
  const [numGuests, setNumGuests] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [guestId, setGuestId] = useState('')
  const [guest2Id, setGuest2Id] = useState('')
  const [availableRooms, setAvailableRooms] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    fetchRooms()
    fetchGuests()
  }, [fetchRooms, fetchGuests])

  // Check availability when dates change
  useEffect(() => {
    const checkRoomAvailability = async () => {
      if (!checkIn || !checkOut) {
        setAvailableRooms([])
        return
      }

      const checkInDate = parseISO(checkIn)
      const checkOutDate = parseISO(checkOut)

      if (checkOutDate <= checkInDate) {
        setAvailableRooms([])
        return
      }

      setLoading(true)
      try {
        const result = await checkAvailability(checkIn, checkOut)
        // Transform API response to match frontend format
        let filtered = result.rooms.map((room) => ({
          id: room.id,
          roomNumber: room.room_number,
          type: room.type,
          status: room.status,
          pricePerNight: parseFloat(room.price_per_night),
          floor: room.floor,
          features: Array.isArray(room.features) ? room.features : [],
          description: room.description,
        }))

        // Filter by type if selected
        if (roomType) {
          filtered = filtered.filter((room) => room.type === roomType)
        }

        setAvailableRooms(filtered)
      } catch (error) {
        console.error('Error checking availability:', error)
        setAvailableRooms([])
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(checkRoomAvailability, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [checkIn, checkOut, roomType, checkAvailability])

  const handleBookRoom = (room) => {
    setSelectedRoom(room)
    setIsModalOpen(true)
  }

  const handleCreateReservation = async () => {
    if (!guestId) {
      alert('Please select a guest')
      return
    }

    const checkInDate = parseISO(checkIn)
    const checkOutDate = parseISO(checkOut)

    if (checkOutDate <= checkInDate) {
      alert('Check-out date must be after check-in date')
      return
    }

    const guest = guests.find((g) => String(g.id) === String(guestId))
    const guest2 = guest2Id ? guests.find((g) => String(g.id) === String(guest2Id)) : null

    if (!guest) {
      alert('Guest not found')
      return
    }

    if (!selectedRoom) {
      alert('Room not found')
      return
    }

    // Validate second guest for double rooms
    if (selectedRoom.type === 'Double' && !guest2Id) {
      if (!confirm('Double room selected. Do you want to proceed with only one guest?')) {
        return
      }
    }

    try {
      await createReservation({
        roomId: selectedRoom.id,
        guestId: String(guest.id),
        guest2Id: guest2 ? String(guest2.id) : undefined,
        checkIn,
        checkOut,
        status: 'Confirmed',
      })

      setIsModalOpen(false)
      setGuestId('')
      setGuest2Id('')
      setSelectedRoom(null)
      alert(`Reservation created successfully for ${selectedRoom.roomNumber}`)
      
      // Refresh availability
      const result = await checkAvailability(checkIn, checkOut)
      let filtered = result.rooms.map((room) => ({
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        status: room.status,
        pricePerNight: parseFloat(room.price_per_night),
        floor: room.floor,
        features: Array.isArray(room.features) ? room.features : [],
        description: room.description,
      }))
      if (roomType) {
        filtered = filtered.filter((room) => room.type === roomType)
      }
      setAvailableRooms(filtered)
    } catch (error) {
      alert(error.message || 'Failed to create reservation')
    }
  }

  const roomTypes = ['Single', 'Double', 'Suite']

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Room Availability</h1>
        <p className="text-gray-600 mt-2">Search for available rooms by date and preferences</p>
      </div>

      {/* Search Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date *</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date *</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || format(new Date(), 'yyyy-MM-dd')}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="input">
              <option value="">All Types</option>
              {roomTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
            <input
              type="number"
              min="1"
              max="10"
              value={numGuests}
              onChange={(e) => setNumGuests(parseInt(e.target.value) || 1)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Available Rooms ({availableRooms.length})
        </h2>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Checking availability...</div>
        ) : availableRooms.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {!checkIn || !checkOut
              ? 'Please select check-in and check-out dates'
              : 'No rooms available for the selected dates'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableRooms.map((room) => {
              const nights = Math.ceil(
                (parseISO(checkOut) - parseISO(checkIn)) / (1000 * 60 * 60 * 24)
              )
              const totalPrice = room.pricePerNight * nights

              return (
                <div key={room.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Room {room.roomNumber}</h3>
                      <p className="text-sm text-gray-600">{room.type}</p>
                    </div>
                    <StatusBadge status={room.status} type="room" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Price per night:</span>
                      <span className="font-medium">${room.pricePerNight}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total ({nights} nights):</span>
                      <span className="font-semibold text-primary-600">${totalPrice}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Floor: {room.floor} | Features: {room.features?.join(', ') || 'N/A'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBookRoom(room)}
                    className="w-full btn btn-primary"
                  >
                    Book Now
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setGuestId('')
          setGuest2Id('')
          setSelectedRoom(null)
        }}
        title={`Book Room ${selectedRoom?.roomNumber}`}
      >
        <div className="space-y-4">
          <GuestSelect
            value={guestId}
            onChange={setGuestId}
            guests={guests}
            label="Primary Guest"
            placeholder="Search for a guest by name, email, or phone..."
          />
          {selectedRoom && selectedRoom.type === 'Double' && (
            <GuestSelect
              value={guest2Id}
              onChange={setGuest2Id}
              guests={guests.filter((g) => String(g.id) !== String(guestId))}
              label="Second Guest (Optional)"
              placeholder="Search for a second guest by name, email, or phone..."
            />
          )}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Room:</span>
                <span className="font-medium">{selectedRoom?.roomNumber} - {selectedRoom?.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium">{format(parseISO(checkIn), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-out:</span>
                <span className="font-medium">{format(parseISO(checkOut), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold text-lg">
                  ${selectedRoom ? selectedRoom.pricePerNight * Math.ceil((parseISO(checkOut) - parseISO(checkIn)) / (1000 * 60 * 60 * 24)) : 0}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setGuestId('')
                setGuest2Id('')
                setSelectedRoom(null)
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleCreateReservation} className="btn btn-primary">
              Confirm Booking
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AvailabilityPage

