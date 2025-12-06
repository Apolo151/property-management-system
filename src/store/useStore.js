import { create } from 'zustand'
import guestsData from '../data/guests.json'
import roomsData from '../data/rooms.json'
import reservationsData from '../data/reservations.json'

/**
 * @typedef {Object} Room
 * @property {string|number} id
 * @property {string} roomNumber
 * @property {string} type - 'Single' | 'Double' | 'Suite'
 * @property {string} status - 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service'
 * @property {number} pricePerNight
 * @property {number} floor
 * @property {string[]} features
 */

/**
 * @typedef {Object} Guest
 * @property {string|number} id
 * @property {string} name
 * @property {string} phone
 * @property {string} email
 * @property {number} pastStays
 * @property {string} notes
 */

/**
 * @typedef {Object} Reservation
 * @property {string} id
 * @property {string} guestName
 * @property {string} guestId
 * @property {string} roomNumber
 * @property {string} checkIn - ISO date string
 * @property {string} checkOut - ISO date string
 * @property {string} status - 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled'
 * @property {number} totalAmount
 * @property {string} guestEmail
 * @property {string} guestPhone
 */

/**
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} reservationId
 * @property {string} guestId
 * @property {string} issueDate - ISO date string
 * @property {string} dueDate - ISO date string
 * @property {number} amount
 * @property {string} status - 'Pending' | 'Paid' | 'Cancelled'
 * @property {string} notes
 * @property {string} paymentMethod - 'Cash' | 'Card' | 'Online'
 */

/**
 * @typedef {Object} Housekeeping
 * @property {string} roomId
 * @property {string} status - 'Clean' | 'Dirty' | 'In Progress'
 * @property {string} lastCleaned - ISO date string
 * @property {string} assignedStaff
 */

/**
 * @typedef {Object} MaintenanceRequest
 * @property {string} id
 * @property {string} roomId
 * @property {string} roomNumber
 * @property {string} title
 * @property {string} description
 * @property {string} priority - 'Low' | 'Medium' | 'High' | 'Urgent'
 * @property {string} status - 'Open' | 'In Progress' | 'Repaired'
 * @property {string} createdAt - ISO date string
 * @property {string} updatedAt - ISO date string
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} category
 * @property {number} amount
 * @property {string} date - ISO date string
 * @property {string} notes
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {string} action - e.g., 'ADD_GUEST', 'UPDATE_RESERVATION_STATUS'
 * @property {string} entityType - 'Guest' | 'Room' | 'Reservation' | 'Invoice' | etc.
 * @property {string} entityId
 * @property {string} userId - 'System' or user ID
 * @property {string} timestamp - ISO date string
 * @property {Object} details
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} type - 'checkin' | 'checkout' | 'invoice' | 'cleaning' | 'maintenance'
 * @property {string} title
 * @property {string} message
 * @property {string} timestamp - ISO date string
 * @property {boolean} read
 * @property {string} link - optional route
 */

const useStore = create((set, get) => ({
  // Initial state loaded from JSON files
  rooms: roomsData,
  guests: guestsData.map(g => ({ ...g, tags: g.tags || [], notes: g.notes || '' })),
  reservations: reservationsData,
  invoices: [],
  housekeeping: roomsData.map(room => ({
    roomId: String(room.id),
    status: room.status === 'Cleaning' ? 'In Progress' : room.status === 'Occupied' ? 'Dirty' : 'Clean',
    lastCleaned: new Date().toISOString(),
    assignedStaff: '',
  })),
  maintenanceRequests: [],
  expenses: [],
  auditLogs: [],
  notifications: [],
  darkMode: localStorage.getItem('darkMode') === 'true',

  // Actions
  addRoom: (room) => {
    const newRoom = {
      ...room,
      id: room.id || get().rooms.length + 1,
    }
    set((state) => ({
      rooms: [...state.rooms, newRoom],
    }))
    return newRoom
  },

  addGuest: (guest) => {
    const newGuest = {
      ...guest,
      id: guest.id || get().guests.length + 1,
      pastStays: guest.pastStays || 0,
      notes: guest.notes || '',
      tags: guest.tags || [],
    }
    set((state) => ({
      guests: [...state.guests, newGuest],
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'ADD_GUEST',
        entityType: 'Guest',
        entityId: String(newGuest.id),
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { name: newGuest.name },
      }],
    }))
    return newGuest
  },

  updateGuest: (guestId, updates) => {
    set((state) => ({
      guests: state.guests.map((g) =>
        String(g.id) === String(guestId) ? { ...g, ...updates } : g
      ),
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'UPDATE_GUEST',
        entityType: 'Guest',
        entityId: String(guestId),
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: updates,
      }],
    }))
  },

  addReservation: (reservation) => {
    const newReservation = {
      ...reservation,
      id: reservation.id || `RES-${String(get().reservations.length + 1).padStart(3, '0')}`,
      createdAt: reservation.createdAt || new Date().toISOString(),
    }
    set((state) => ({
      reservations: [...state.reservations, newReservation],
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'ADD_RESERVATION',
        entityType: 'Reservation',
        entityId: newReservation.id,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { guestName: newReservation.guestName, roomNumber: newReservation.roomNumber },
      }],
    }))
    return newReservation
  },

  updateReservationStatus: (reservationId, status) => {
    const reservation = get().reservations.find(r => r.id === reservationId)
    const wasCheckedOut = reservation?.status === 'Checked-out'
    
    set((state) => {
      const updatedReservations = state.reservations.map((res) =>
        res.id === reservationId ? { ...res, status } : res
      )
      
      // Auto-generate invoice when status changes to Checked-out
      const updatedReservation = updatedReservations.find(r => r.id === reservationId)
      let newInvoices = [...state.invoices]
      
      if (status === 'Checked-out' && !wasCheckedOut && updatedReservation) {
        const today = new Date()
        const dueDate = new Date(today)
        dueDate.setDate(dueDate.getDate() + 30)
        
        const guest = state.guests.find(g => 
          String(g.id) === String(updatedReservation.guestId) || 
          g.name === updatedReservation.guestName
        )
        
        if (guest) {
          const newInvoice = {
            id: `INV-${String(state.invoices.length + 1).padStart(3, '0')}`,
            reservationId: reservationId,
            guestId: String(guest.id),
            issueDate: today.toISOString().split('T')[0],
            dueDate: dueDate.toISOString().split('T')[0],
            amount: updatedReservation.totalAmount || 0,
            status: 'Pending',
            notes: `Auto-generated invoice for reservation ${reservationId}`,
            paymentMethod: '',
          }
          newInvoices.push(newInvoice)
        }
      }
      
      return {
        reservations: updatedReservations,
        invoices: newInvoices,
        auditLogs: [...state.auditLogs, {
          id: `LOG-${Date.now()}`,
          action: 'UPDATE_RESERVATION_STATUS',
          entityType: 'Reservation',
          entityId: reservationId,
          userId: 'System',
          timestamp: new Date().toISOString(),
          details: { oldStatus: reservation?.status, newStatus: status },
        }],
      }
    })
  },

  addInvoice: (invoice) => {
    const newInvoice = {
      ...invoice,
      id: invoice.id || `INV-${String(get().invoices.length + 1).padStart(3, '0')}`,
      status: invoice.status || 'Pending',
      notes: invoice.notes || '',
      paymentMethod: invoice.paymentMethod || '',
    }
    set((state) => ({
      invoices: [...state.invoices, newInvoice],
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'ADD_INVOICE',
        entityType: 'Invoice',
        entityId: newInvoice.id,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { amount: newInvoice.amount, reservationId: newInvoice.reservationId },
      }],
    }))
    return newInvoice
  },

  updateInvoiceStatus: (invoiceId, status, paymentMethod = '') => {
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, status, paymentMethod: paymentMethod || inv.paymentMethod } : inv
      ),
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'UPDATE_INVOICE_STATUS',
        entityType: 'Invoice',
        entityId: invoiceId,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { status, paymentMethod },
      }],
    }))
  },

  // Housekeeping actions
  updateHousekeepingStatus: (roomId, status, assignedStaff = '') => {
    set((state) => ({
      housekeeping: state.housekeeping.map((hk) =>
        hk.roomId === String(roomId)
          ? {
              ...hk,
              status,
              lastCleaned: status === 'Clean' ? new Date().toISOString() : hk.lastCleaned,
              assignedStaff: assignedStaff || hk.assignedStaff,
            }
          : hk
      ),
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'UPDATE_HOUSEKEEPING_STATUS',
        entityType: 'Room',
        entityId: String(roomId),
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { status, assignedStaff },
      }],
    }))
  },

  // Maintenance actions
  addMaintenanceRequest: (request) => {
    const newRequest = {
      ...request,
      id: request.id || `MNT-${String(get().maintenanceRequests.length + 1).padStart(3, '0')}`,
      status: request.status || 'Open',
      createdAt: request.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({
      maintenanceRequests: [...state.maintenanceRequests, newRequest],
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'ADD_MAINTENANCE_REQUEST',
        entityType: 'Maintenance',
        entityId: newRequest.id,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { roomNumber: newRequest.roomNumber, title: newRequest.title },
      }],
    }))
    return newRequest
  },

  updateMaintenanceStatus: (requestId, status) => {
    set((state) => ({
      maintenanceRequests: state.maintenanceRequests.map((req) =>
        req.id === requestId ? { ...req, status, updatedAt: new Date().toISOString() } : req
      ),
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'UPDATE_MAINTENANCE_STATUS',
        entityType: 'Maintenance',
        entityId: requestId,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { status },
      }],
    }))
  },

  // Expense actions
  addExpense: (expense) => {
    const newExpense = {
      ...expense,
      id: expense.id || `EXP-${String(get().expenses.length + 1).padStart(3, '0')}`,
      date: expense.date || new Date().toISOString().split('T')[0],
      notes: expense.notes || '',
    }
    set((state) => ({
      expenses: [...state.expenses, newExpense],
      auditLogs: [...state.auditLogs, {
        id: `LOG-${Date.now()}`,
        action: 'ADD_EXPENSE',
        entityType: 'Expense',
        entityId: newExpense.id,
        userId: 'System',
        timestamp: new Date().toISOString(),
        details: { category: newExpense.category, amount: newExpense.amount },
      }],
    }))
    return newExpense
  },

  // Notification actions
  addNotification: (notification) => {
    const newNotification = {
      ...notification,
      id: notification.id || `NOTIF-${Date.now()}`,
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
    }
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }))
    return newNotification
  },

  markNotificationAsRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      ),
    }))
  },

  markAllNotificationsAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notif) => ({ ...notif, read: true })),
    }))
  },

  // Dark mode
  toggleDarkMode: () => {
    const newMode = !get().darkMode
    localStorage.setItem('darkMode', String(newMode))
    set({ darkMode: newMode })
  },
}))

export default useStore

