import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RoomsPage from './pages/RoomsPage'
import RoomTypesPage from './pages/RoomTypesPage'
import ReservationsPage from './pages/ReservationsPage'
import CheckInsPage from './pages/CheckInsPage'
import CalendarPage from './pages/CalendarPage'
import AvailabilityPage from './pages/AvailabilityPage'
import BookingTimeline from './components/BookingTimeline'
import GuestsPage from './pages/GuestsPage'
import GuestProfilePage from './pages/GuestProfilePage'
import InvoicesPage from './pages/InvoicesPage'
import ExpensesPage from './pages/ExpensesPage'
import MaintenancePage from './pages/MaintenancePage'
import ReportsPage from './pages/ReportsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'
import MainLayout from './layouts/MainLayout'
import useAuthStore from './store/authStore'
import ToastContainer from './components/ToastContainer'
import ConfirmationDialog from './components/ConfirmationDialog'
import PromptDialog from './components/PromptDialog'

function App() {
  const { isAuthenticated, initialize, ensureValidToken, logout } = useAuthStore()

  // Initialize auth on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Proactive token refresh - check every 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return

    const checkAndRefreshToken = () => {
      ensureValidToken().catch(() => {
        // Token refresh failed, user will be logged out automatically
      })
    }

    // Check immediately, then every 5 minutes
    checkAndRefreshToken()
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, ensureValidToken])

  return (
    <>
      <ToastContainer />
      <ConfirmationDialog />
      <PromptDialog />
      <Router>
        <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout onLogout={logout}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/rooms" element={<RoomsPage />} />
                  <Route path="/room-types" element={<RoomTypesPage />} />
                  <Route path="/reservations" element={<ReservationsPage />} />
                  <Route path="/check-ins" element={<CheckInsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/availability" element={<AvailabilityPage />} />
                  <Route path="/timeline" element={<BookingTimeline />} />
                  <Route path="/guests" element={<GuestsPage />} />
                  <Route path="/guests/:id" element={<GuestProfilePage />} />
                  <Route path="/invoices" element={<InvoicesPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
    </>
  )
}

export default App
