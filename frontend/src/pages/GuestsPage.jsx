import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchInput from '../components/SearchInput'
import Modal from '../components/Modal'
import useGuestsStore from '../store/guestsStore'
import useAuthStore from '../store/authStore'
import { useToast } from '../hooks/useToast'

const GuestsPage = () => {
  const activeHotelId = useAuthStore((s) => s.activeHotelId)
  const {
    guests,
    loading: guestsLoading,
    error: guestsError,
    fetchGuests,
    createGuest,
  } = useGuestsStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')
  const [isReturningOnly, setIsReturningOnly] = useState(false)
  const [hasNotesOnly, setHasNotesOnly] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newGuest, setNewGuest] = useState({
    name: '',
    phone: '',
    email: '',
    pastStays: 0,
    notes: '',
  })

  // Fetch guests on mount and when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchGuests(searchTerm ? { search: searchTerm } : {})
    }, 300) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [activeHotelId, searchTerm, fetchGuests])

  const filteredAndSortedGuests = useMemo(() => {
    // API handles search, so we just filter toggles and sort the results
    let filtered = [...guests]

    if (isReturningOnly) {
      filtered = filtered.filter(g => g.pastStays >= 1)
    }

    if (hasNotesOnly) {
      filtered = filtered.filter(g => g.notes && g.notes.trim().length > 0)
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'email') {
        comparison = a.email.localeCompare(b.email)
      } else if (sortBy === 'phone') {
        comparison = a.phone.localeCompare(b.phone)
      } else if (sortBy === 'pastStays') {
        comparison = (a.pastStays || 0) - (b.pastStays || 0)
      } else if (sortBy === 'id') {
        comparison = String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [searchTerm, guests, sortBy, sortOrder, isReturningOnly, hasNotesOnly])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="text-gray-400 dark:text-gray-500">↕</span>
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  const handleAddGuest = async () => {
    // Validation
    if (!newGuest.name) {
      toast.error('Please fill in the name field')
      return
    }

    // Email validation if provided
    if (newGuest.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newGuest.email)) {
        toast.error('Please enter a valid email address')
        return
      }
    }

    try {
      await createGuest(newGuest)
      setIsModalOpen(false)
      setNewGuest({
        name: '',
        phone: '',
        email: '',
        pastStays: 0,
        notes: '',
      })
      toast.success('Guest created successfully!')
    } catch (error) {
      toast.error(error.message || 'Failed to create guest')
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Guests</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage guest information</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          + Add Guest
        </button>
      </div>

      {/* Error message */}
      {guestsError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{guestsError}</span>
        </div>
      )}

      {/* Loading state */}
      {guestsLoading && (
        <div className="mb-4 text-center text-gray-600 dark:text-gray-400">Loading guests...</div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div className="w-full lg:w-1/3">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by guest name..."
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 lg:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isReturningOnly} 
                onChange={(e) => setIsReturningOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:border-gray-600"
              />
              Returning Only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={hasNotesOnly} 
                onChange={(e) => setHasNotesOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:border-gray-600"
              />
              Has Notes
            </label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700">
              <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Sort By:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm bg-transparent border-none focus:ring-0 p-0 pr-6 text-gray-900 dark:text-gray-100 cursor-pointer"
              >
                <option value="id">Most Recent</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="pastStays">Past Stays</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 px-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                title="Toggle sort order"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guests Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <SortIcon column="name" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center gap-1">
                    Phone
                    <SortIcon column="phone" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-1">
                    Email
                    <SortIcon column="email" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('pastStays')}
                >
                  <div className="flex items-center gap-1">
                    Past Stays
                    <SortIcon column="pastStays" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedGuests.map((guest) => (
                <tr
                  key={guest.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => navigate(`/guests/${guest.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{guest.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{guest.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{guest.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{guest.pastStays}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {guest.notes || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedGuests.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">No guests found</div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAndSortedGuests.length} of {guests.length} guests
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={newGuest.email}
              onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={newGuest.phone}
              onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

