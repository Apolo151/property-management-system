import { useState, useEffect } from 'react'
import Modal from './Modal'

const GuestFormModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialName = '',
  existingGuests = [],
  title = 'Create New Guest'
}) => {
  const [formData, setFormData] = useState({
    name: initialName,
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState('')

  // Reset form when modal opens with new initial name
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName,
        email: '',
        phone: ''
      })
      setErrors({})
      setDuplicateWarning('')
    }
  }, [isOpen, initialName])

  // Check for duplicate names (exact match)
  useEffect(() => {
    if (formData.name.trim()) {
      const exactMatch = existingGuests.find(
        guest => guest.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
      )
      if (exactMatch) {
        setDuplicateWarning(`A guest with the name "${exactMatch.name}" already exists.`)
      } else {
        setDuplicateWarning('')
      }
    } else {
      setDuplicateWarning('')
    }
  }, [formData.name, existingGuests])

  const validateEmail = (email) => {
    if (!email) return true // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone) => {
    if (!phone) return true // Phone is optional
    // Basic phone validation - at least 10 digits
    const phoneDigits = phone.replace(/\D/g, '')
    return phoneDigits.length >= 10
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const newErrors = {}

    // Validate name (required)
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    // Validate email (optional, but must be valid if provided)
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Validate phone (optional, but must be valid if provided)
    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (at least 10 digits)'
    }

    // Check for duplicate
    if (duplicateWarning) {
      newErrors.name = 'This guest name already exists'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Submit the form
    onSubmit({
      name: formData.name.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined
    })
  }

  const handleCancel = () => {
    setFormData({ name: '', email: '', phone: '' })
    setErrors({})
    setDuplicateWarning('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={title} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Guest Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Enter guest name"
            autoFocus
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
          {duplicateWarning && !errors.name && (
            <p className="mt-1 text-sm text-yellow-600">{duplicateWarning}</p>
          )}
        </div>

        {/* Email field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email (Optional)
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`input w-full ${errors.email ? 'border-red-500' : ''}`}
            placeholder="guest@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Phone field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`input w-full ${errors.phone ? 'border-red-500' : ''}`}
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!!duplicateWarning}
          >
            Create Guest
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default GuestFormModal
