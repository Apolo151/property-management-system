import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function mapUiType(serverType) {
  const t = (serverType || '').toUpperCase()
  if (t.includes('CHECK_IN')) return 'checkin'
  if (t.includes('CHECK_OUT')) return 'checkout'
  if (t.includes('MAINTENANCE')) return 'maintenance'
  if (t.includes('HOUSEKEEPING')) return 'cleaning'
  if (t.includes('INVOICE')) return 'invoice'
  return 'default'
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setItems([])
      return
    }
    try {
      setLoading(true)
      const data = await api.notifications.list({ limit: 50 })
      const rows = data.notifications || []
      setItems(
        rows.map((n) => ({
          id: n.id,
          type: mapUiType(n.type),
          title: n.title,
          message: n.body || '',
          timestamp: n.created_at,
          read: Boolean(n.read),
          link: n.payload?.link || null,
        })),
      )
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  const unreadCount = items.filter((n) => !n.read).length

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'checkin':
        return '📥'
      case 'checkout':
        return '📤'
      case 'invoice':
        return '💰'
      case 'cleaning':
        return '🧹'
      case 'maintenance':
        return '🔧'
      default:
        return '🔔'
    }
  }

  const markNotificationAsRead = async (id) => {
    try {
      await api.notifications.markRead(id)
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {
      /* ignore */
    }
  }

  const markAllNotificationsAsRead = async () => {
    try {
      await api.notifications.markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 focus:outline-none"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsAsRead()}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
              )}
              {!loading && items.length === 0 && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No notifications
                </div>
              )}
              {!loading &&
                items.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                      !notif.read ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                    onClick={() => {
                      if (!notif.read) {
                        markNotificationAsRead(notif.id)
                      }
                      if (notif.link) {
                        setIsOpen(false)
                        navigate(notif.link)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getNotificationIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${!notif.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notif.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {format(parseISO(notif.timestamp), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1"></div>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
