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
 */

const useStore = create((set, get) => ({
  // Initial state loaded from JSON files
  rooms: roomsData,
  guests: guestsData,
  reservations: reservationsData,
  invoices: [],

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
    }
    set((state) => ({
      guests: [...state.guests, newGuest],
    }))
    return newGuest
  },

  addReservation: (reservation) => {
    const newReservation = {
      ...reservation,
      id: reservation.id || `RES-${String(get().reservations.length + 1).padStart(3, '0')}`,
    }
    set((state) => ({
      reservations: [...state.reservations, newReservation],
    }))
    return newReservation
  },

  updateReservationStatus: (reservationId, status) => {
    set((state) => ({
      reservations: state.reservations.map((res) =>
        res.id === reservationId ? { ...res, status } : res
      ),
    }))
  },

  addInvoice: (invoice) => {
    const newInvoice = {
      ...invoice,
      id: invoice.id || `INV-${String(get().invoices.length + 1).padStart(3, '0')}`,
      status: invoice.status || 'Pending',
      notes: invoice.notes || '',
    }
    set((state) => ({
      invoices: [...state.invoices, newInvoice],
    }))
    return newInvoice
  },

  updateInvoiceStatus: (invoiceId, status) => {
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, status } : inv
      ),
    }))
  },
}))

export default useStore

