import { useState, useMemo } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import SearchInput from '../components/SearchInput'
import FilterSelect from '../components/FilterSelect'
import useStore from '../store/useStore'

const InvoicesPage = () => {
  const { invoices, reservations, guests, updateInvoiceStatus } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.reservationId?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = !statusFilter || invoice.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [searchTerm, statusFilter, invoices])

  const getGuestName = (guestId) => {
    const guest = guests.find((g) => String(g.id) === String(guestId))
    return guest ? guest.name : 'Unknown Guest'
  }

  const getReservationInfo = (reservationId) => {
    const reservation = reservations.find((r) => r.id === reservationId)
    return reservation
  }

  const handleStatusChange = (invoiceId, newStatus) => {
    if (window.confirm(`Are you sure you want to mark this invoice as ${newStatus}?`)) {
      updateInvoiceStatus(invoiceId, newStatus)
    }
  }

  const statusOptions = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Paid', label: 'Paid' },
    { value: 'Cancelled', label: 'Cancelled' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invoices / Accounting</h1>
        <p className="text-gray-600 mt-2">View and manage all invoices</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by invoice ID or reservation ID..."
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="All Statuses"
            label="Status"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reservation ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => {
                const reservation = getReservationInfo(invoice.reservationId)
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.reservationId || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getGuestName(invoice.guestId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(parseISO(invoice.issueDate), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(parseISO(invoice.dueDate), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${invoice.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={invoice.status}
                        type="invoice"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {invoice.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStatusChange(invoice.id, 'Paid')}
                            className="text-green-600 hover:text-green-900"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => handleStatusChange(invoice.id, 'Cancelled')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {invoice.status === 'Paid' && (
                        <span className="text-gray-400">-</span>
                      )}
                      {invoice.status === 'Cancelled' && (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {invoices.length === 0
                ? 'No invoices yet. Create invoices from reservations.'
                : 'No invoices found matching your filters.'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredInvoices.length} of {invoices.length} invoices
      </div>
    </div>
  )
}

export default InvoicesPage

