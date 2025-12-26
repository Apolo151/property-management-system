import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

const SettingsPage = () => {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.settings.get()
        setSettings(data)
      } catch (err) {
        setError(err.message || 'Failed to load hotel settings')
        console.error('Error fetching settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Hotel information and configuration</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading settings...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Hotel information and configuration</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="text-red-600">Error: {error}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Hotel information and configuration</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">No settings found</div>
          </div>
        </div>
      </div>
    )
  }

  // Format time (HH:MM:SS) to readable format (HH:MM)
  const formatTime = (time) => {
    if (!time) return 'N/A'
    return time.substring(0, 5) // Extract HH:MM from HH:MM:SS
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Hotel information and configuration</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Hotel Information</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Name</label>
            <p className="text-gray-900">{settings.hotel_name || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <p className="text-gray-900">
              {settings.address || 'N/A'}
              {settings.city && (
                <>
                  <br />
                  {settings.city}
                  {settings.country && `, ${settings.country}`}
                </>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <p className="text-gray-900">{settings.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900">{settings.email || 'N/A'}</p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-in Time
              </label>
              <p className="text-gray-900">{formatTime(settings.check_in_time)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-out Time
              </label>
              <p className="text-gray-900">{formatTime(settings.check_out_time)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <p className="text-gray-900">{settings.currency || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate</label>
              <p className="text-gray-900">{settings.tax_rate ? `${settings.tax_rate}%` : 'N/A'}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <p className="text-gray-900">{settings.timezone || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage

