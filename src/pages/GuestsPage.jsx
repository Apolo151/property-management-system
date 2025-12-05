import { useState, useMemo } from 'react'
import SearchInput from '../components/SearchInput'
import Modal from '../components/Modal'
import useStore from '../store/useStore'

const GuestsPage = () => {
  const { guests, addGuest } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newGuest, setNewGuest] = useState({
    name: '',
    phone: '',
    email: '',
    pastStays: 0,
    notes: '',
  })

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) =>
      guest.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm, guests])

  const handleAddGuest = () => {
    // Validation
    if (!newGuest.name || !newGuest.email || !newGuest.phone) {
      alert('Please fill in all required fields (Name, Email, Phone)')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newGuest.email)) {
      alert('Please enter a valid email address')
      return
    }

    addGuest(newGuest)
    setIsModalOpen(false)
    setNewGuest({
      name: '',
      phone: '',
      email: '',
      pastStays: 0,
      notes: '',
    })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guests</h1>
          <p className="text-gray-600 mt-2">View and manage guest information</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          + Add Guest
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by guest name..."
        />
      </div>

      {/* Guests Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Past Stays
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{guest.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{guest.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{guest.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{guest.pastStays}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {guest.notes || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredGuests.length === 0 && (
            <div className="text-center py-12 text-gray-500">No guests found</div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredGuests.length} of {guests.length} guests
      </div>

      {/* Add Guest Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setNewGuest({
            name: '',
            phone: '',
            email: '',
            pastStays: 0,
            notes: '',
          })
        }}
        title="Add New Guest"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={newGuest.name}
              onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={newGuest.email}
              onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone *
            </label>
            <input
              type="tel"
              value={newGuest.phone}
              onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Past Stays
            </label>
            <input
              type="number"
              min="0"
              value={newGuest.pastStays}
              onChange={(e) => setNewGuest({ ...newGuest, pastStays: parseInt(e.target.value) || 0 })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={newGuest.notes}
              onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
              className="input"
              rows="3"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setNewGuest({
                  name: '',
                  phone: '',
                  email: '',
                  pastStays: 0,
                  notes: '',
                })
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleAddGuest} className="btn btn-primary">
              Add Guest
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default GuestsPage

