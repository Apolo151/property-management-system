import { useState, useMemo, useEffect } from 'react'
import Modal from '../components/Modal'
import { format, parseISO, isValid } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import SearchInput from '../components/SearchInput'
import FilterSelect from '../components/FilterSelect'
import useInvoicesStore from '../store/invoicesStore'
import useAuthStore from '../store/authStore'
import { api } from '../utils/api'
import { useToast } from '../hooks/useToast'
import { useConfirmation } from '../hooks/useConfirmation'
import ReservationDetailsModal from '../components/ReservationDetailsModal'

const safeFormatDate = (v) => {
  if (!v) return '-';
  const d = parseISO(v);
  return isValid(d) ? format(d, 'MMM dd, yyyy') : '-';
}

const InvoicesPage = () => {
  const activeHotelId = useAuthStore((s) => s.activeHotelId)
  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    fetchInvoices,
    updateInvoice,
  } = useInvoicesStore()
  const toast = useToast()
  const confirmation = useConfirmation()
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [isOverdueOnly, setIsOverdueOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('issueDate')
  const [sortOrder, setSortOrder] = useState('desc')

  // UI state for modals and forms
  const [reservationModalOpen, setReservationModalOpen] = useState(false)
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [editNotesValue, setEditNotesValue] = useState('')
  
  const [editingAmountId, setEditingAmountId] = useState(null)
  const [editAmountValue, setEditAmountValue] = useState('')

  const [loadingActionId, setLoadingActionId] = useState(null)

  // Fetch invoices on mount and when filters change
  useEffect(() => {
    const filters = {};
    if (statusFilter) filters.status = statusFilter;
    if (searchTerm) filters.search = searchTerm;
    
    const timeoutId = setTimeout(() => {
      fetchInvoices(filters);
    }, searchTerm ? 300 : 0); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [activeHotelId, statusFilter, searchTerm, fetchInvoices]);

  const filteredAndSortedInvoices = useMemo(() => {
    // API handles search and status filtering, so we just sort the results
    let filtered = [...invoices]

    // Parse helper
    const parseDateMs = (v) => {
      if (v == null || v === '') return null
      const d = parseISO(v)
      return isValid(d) ? d.getTime() : null
    }

    if (paymentMethodFilter) {
      filtered = filtered.filter(inv => inv.paymentMethod === paymentMethodFilter)
    }

    if (isOverdueOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(inv => {
        if (inv.status === 'Paid' || inv.status === 'Cancelled' || !inv.dueDate) return false;
        const outDate = parseISO(inv.dueDate);
        return isValid(outDate) && outDate < today;
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'issueDate') {
        const ta = parseDateMs(a.issueDate)
        const tb = parseDateMs(b.issueDate)
        if (ta == null && tb == null) comparison = 0
        else if (ta == null) comparison = 1
        else if (tb == null) comparison = -1
        else comparison = ta - tb
      } else if (sortBy === 'dueDate') {
        const ta = parseDateMs(a.dueDate)
        const tb = parseDateMs(b.dueDate)
        if (ta == null && tb == null) comparison = 0
        else if (ta == null) comparison = 1
        else if (tb == null) comparison = -1
        else comparison = ta - tb
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount
      } else if (sortBy === 'id') {
        comparison = String(a.id).localeCompare(String(b.id))
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [invoices, sortBy, sortOrder, paymentMethodFilter, isOverdueOnly])

  const handleDownloadPdf = async (invoice) => {
    try {
      setLoadingActionId(invoice.id)
      const blob = await api.invoices.downloadPdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${String(invoice.id).slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(err.message || 'Failed to download PDF')
    } finally {
      setLoadingActionId(null)
    }
  }

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

  const handleStatusChange = async (invoiceId, newStatus) => {
    if (newStatus === 'Paid') {
      const invoice = invoices.find((inv) => inv.id === invoiceId)
      setSelectedInvoice(invoice)
      setPaymentMethod(invoice?.paymentMethod || '')
      setPaymentAmount(invoice?.amount != null ? String(invoice.amount) : '')
      setPaymentNotes(invoice?.notes || '')
      setPaymentModalOpen(true)
    } else {
      const confirmed = await confirmation({
        title: 'Change Invoice Status',
        message: `Are you sure you want to mark this invoice as ${newStatus}?`,
        variant: 'warning',
      })
      if (confirmed) {
        try {
          setLoadingActionId(invoiceId)
          await updateInvoice(invoiceId, { status: newStatus })
          toast.success('Invoice status updated successfully!')
        } catch (error) {
          toast.error(error.message || 'Failed to update invoice status')
        } finally {
          setLoadingActionId(null)
        }
      }
    }
  }

  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) {
      toast.error('No invoice selected')
      return
    }

    if (!paymentMethod) {
      toast.error('Please select a payment method')
      return
    }

    const amountValue = Number(paymentAmount)
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount greater than 0')
      return
    }
    
    try {
      setLoadingActionId(selectedInvoice.id)
      await updateInvoice(selectedInvoice.id, {
        status: 'Paid',
        paymentMethod,
        amount: amountValue,
        notes: paymentNotes,
      })
      setPaymentModalOpen(false)
      setSelectedInvoice(null)
      setPaymentMethod('')
      setPaymentAmount('')
      setPaymentNotes('')
      toast.success('Invoice marked as paid successfully!')
    } catch (error) {
      toast.error(error.message || 'Failed to update invoice')
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleNotesClick = (invoice) => {
    if (invoice.status === 'Cancelled') return;
    setEditingNotesId(invoice.id);
    setEditNotesValue(invoice.notes || '');
  };

  const handleNotesBlur = async (invoice) => {
    setEditingNotesId(null);
    if (editNotesValue === (invoice.notes || '')) return;
    try {
      await updateInvoice(invoice.id, { notes: editNotesValue });
      toast.success('Notes updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update notes');
    }
  };

  const handleAmountClick = (invoice) => {
    setEditingAmountId(invoice.id);
    setEditAmountValue(invoice.amount || '');
  };

  const handleAmountBlur = async (invoice) => {
    setEditingAmountId(null);
    const newAmount = Number(editAmountValue);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Amount must be a valid number greater than 0');
      return;
    }
    if (newAmount === invoice.amount) return;
    
    try {
      await updateInvoice(invoice.id, { amount: newAmount });
      toast.success('Amount updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update amount');
    }
  };

  const handleReservationClick = (resId) => {
    if (!resId) return;
    setSelectedReservationId(resId);
    setReservationModalOpen(true);
  };

  const statusOptions = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Paid', label: 'Paid' },
    { value: 'Cancelled', label: 'Cancelled' },
  ]

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set(invoices.map(inv => inv.paymentMethod).filter(Boolean))
    return Array.from(methods).map(method => ({ value: method, label: method }))
  }, [invoices])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Invoices / Accounting</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage all invoices</p>
      </div>

      {/* Error message */}
      {invoicesError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{invoicesError}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by invoice ID, reservation ID, or guest name..."
              label="Search"
            />
          </div>
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="All Statuses"
            label="Status"
          />
          <FilterSelect
            value={paymentMethodFilter}
            onChange={setPaymentMethodFilter}
            options={paymentMethodOptions}
            placeholder="All Methods"
            label="Payment Method"
          />
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isOverdueOnly} 
              onChange={(e) => setIsOverdueOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="font-medium text-red-600 dark:text-red-400">Show Overdue Only</span>
          </label>
          {(searchTerm || statusFilter || paymentMethodFilter || isOverdueOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPaymentMethodFilter('');
                setIsOverdueOnly(false);
              }}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {invoicesLoading && (
        <div className="mb-4 text-center text-gray-600 dark:text-gray-400">Loading invoices...</div>
      )}

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    Invoice ID
                    <SortIcon column="id" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reservation ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('issueDate')}
                >
                  <div className="flex items-center gap-1">
                    Issue Date
                    <SortIcon column="issueDate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-1">
                    Due Date
                    <SortIcon column="dueDate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    <SortIcon column="amount" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-gray-500 dark:text-gray-400 border-b-0">
                    {invoices.length === 0
                      ? 'No invoices yet. Create invoices from reservations.'
                      : 'No invoices found matching your filters.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100" title={invoice.id}>
                        {invoice.id?.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className="text-sm text-gray-900 dark:text-gray-100" 
                        title={invoice.reservationId || ''}
                      >
                        {invoice.reservationId ? (
                          <span 
                            onClick={() => handleReservationClick(invoice.reservationId)}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 cursor-pointer hover:underline"
                          >
                            {invoice.reservationId.substring(0, 8)}...
                          </span>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{invoice.guestName || 'Unknown Guest'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {safeFormatDate(invoice.issueDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {safeFormatDate(invoice.dueDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAmountId === invoice.id ? (
                        <div className="flex items-center">
                           <span className="text-sm text-gray-500 mr-1">$</span>
                           <input
                             autoFocus
                             type="number"
                             min="0.01"
                             step="0.01"
                             className="input py-1 px-2 h-8 w-24 text-sm"
                             value={editAmountValue}
                             onChange={(e) => setEditAmountValue(e.target.value)}
                             onBlur={() => handleAmountBlur(invoice)}
                             onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                           />
                        </div>
                      ) : (
                        <div 
                          className={`text-sm font-medium text-gray-900 dark:text-gray-100 group flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-1 -m-1 rounded`}
                          onClick={() => handleAmountClick(invoice)}
                        >
                          ${invoice.amount.toLocaleString()}
                          <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs">✏️</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={invoice.status}
                        type="invoice"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingNotesId === invoice.id ? (
                        <input
                          autoFocus
                          type="text"
                          className="input py-1 px-2 h-8 w-32 md:w-48 text-sm"
                          value={editNotesValue}
                          onChange={(e) => setEditNotesValue(e.target.value)}
                          onBlur={() => handleNotesBlur(invoice)}
                          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                        />
                      ) : (
                        <div 
                          className={`text-sm text-gray-500 truncate max-w-[120px] md:max-w-[200px] ${invoice.status !== 'Cancelled' ? 'cursor-text hover:bg-gray-100 dark:hover:bg-gray-600 p-1 -m-1 rounded group' : ''}`}
                          title={invoice.notes || 'Click to add notes'}
                          onClick={() => handleNotesClick(invoice)}
                        >
                          {invoice.notes || (invoice.status !== 'Cancelled' ? <span className="opacity-0 group-hover:opacity-100 italic text-gray-400">Add note</span> : '-')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.paymentMethod || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {loadingActionId === invoice.id ? (
                        <span className="text-gray-500 italic">Processing...</span>
                      ) : (
                        <div className="flex flex-wrap gap-2 items-center">
                          {invoice.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(invoice)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Download PDF
                            </button>
                          )}
                          {invoice.status === 'Pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(invoice.id, 'Paid')}
                                className="text-green-600 hover:text-green-900"
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(invoice.id, 'Cancelled')}
                                className="text-red-600 hover:text-red-900"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAndSortedInvoices.length} of {invoices.length} invoices
      </div>

      {/* Payment Method Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false)
          setSelectedInvoice(null)
          setPaymentMethod('')
          setPaymentAmount('')
          setPaymentNotes('')
        }}
        title="Mark Invoice as Paid"
      >
        <div className="space-y-4">
          {selectedInvoice && (
            <>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Invoice ID:</span>
                    <span className="font-medium">{selectedInvoice.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Current Amount:</span>
                    <span className="font-semibold">${selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input"
                  placeholder="Enter payment amount"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select payment method</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Online">Online</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input min-h-[96px]"
                  placeholder="Add payment notes"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setPaymentModalOpen(false)
                    setSelectedInvoice(null)
                    setPaymentMethod('')
                    setPaymentAmount('')
                    setPaymentNotes('')
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleMarkAsPaid} className="btn btn-primary">
                  Mark as Paid
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Reservation Details Modal */}
      <ReservationDetailsModal 
        isOpen={reservationModalOpen}
        onClose={() => {
          setReservationModalOpen(false)
          setSelectedReservationId(null)
        }}
        reservationId={selectedReservationId}
      />
    </div>
  )
}

export default InvoicesPage

