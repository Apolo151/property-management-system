import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RoomsPage from './pages/RoomsPage'
import ReservationsPage from './pages/ReservationsPage'
import CalendarPage from './pages/CalendarPage'
import GuestsPage from './pages/GuestsPage'
import SettingsPage from './pages/SettingsPage'
import MainLayout from './layouts/MainLayout'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  )

  useEffect(() => {
    // Persist auth state
    if (isAuthenticated) {
      localStorage.setItem('isAuthenticated', 'true')
    } else {
      localStorage.removeItem('isAuthenticated')
    }
  }, [isAuthenticated])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout onLogout={handleLogout}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/rooms" element={<RoomsPage />} />
                  <Route path="/reservations" element={<ReservationsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/guests" element={<GuestsPage />} />
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
  )
}

export default App

