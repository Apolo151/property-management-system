# QloApps Configuration UI Guide

## Visual States

### State 1: Not Configured

```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings                                                              │
│ Hotel information and configuration                                  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Hotel Information │ Channel Manager │ Staff Management │ Data...     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ ■ QloApps Channel Manager                                            │
│                                                                       │
│ QloApps integration for synchronizing reservations, availability,   │
│ and rates with your booking engine.                                  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │                                                               │  │
│ │  ⚪ QloApps                              Not Configured       │  │
│ │                                                               │  │
│ │  Open-source hotel management and booking engine. Syncs      │  │
│ │  reservations, availability, and room rates automatically.   │  │
│ │                                                               │  │
│ │  [Setup Connection]  [Test Connection]                       │  │
│ │                                                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ ✓ Sync Features                                               │  │
│ │ ✓ Automatic reservation sync (create, update, cancel)        │  │
│ │ ✓ Room availability updates                                  │  │
│ │ ✓ Rate synchronization                                       │  │
│ │ ✓ Room type mapping                                          │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ ℹ️ Configuration Status                                        │  │
│ │ QloApps is not currently configured. Click the               │  │
│ │ "Setup Connection" button above to configure the integration.│  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### State 2: Setup Form Open

```
┌──────────────────────────────────────────────────────────────────────┐
│ ■ QloApps Channel Manager                                            │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │                                                               │  │
│ │  ⚪ QloApps                              Not Configured       │  │
│ │                                                               │  │
│ │  Open-source hotel management and booking engine. Syncs      │  │
│ │  reservations, availability, and room rates automatically.   │  │
│ │                                                               │  │
│ │  [Setup Connection]  [Test Connection]                       │  │
│ │                                                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ Setup QloApps Connection                                     │  │
│ │                                                               │  │
│ │ QloApps Base URL *                                           │  │
│ │ [https://hotel.qloapps.com                      ]            │  │
│ │ e.g., https://hotel.qloapps.com (without trailing slash)   │  │
│ │                                                               │  │
│ │ QloApps Hotel ID *                                           │  │
│ │ [123                                             ]           │  │
│ │ Hotel ID from QloApps (id_hotel)                            │  │
│ │                                                               │  │
│ │ WebService API Key *                                         │  │
│ │ [•••••••••••••••••••••••••••••••••               ]           │  │
│ │ Your API key will be encrypted and never shown in plain text│  │
│ │                                                               │  │
│ │ Sync Interval (minutes)                                      │  │
│ │ [15 minutes                            ▼         ]           │  │
│ │ How often to sync with QloApps                              │  │
│ │                                                               │  │
│ │ [Save Configuration]  [Cancel]                              │  │
│ │                                                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ ✓ Sync Features                                               │  │
│ │ ✓ Automatic reservation sync (create, update, cancel)        │  │
│ │ ✓ Room availability updates                                  │  │
│ │ ✓ Rate synchronization                                       │  │
│ │ ✓ Room type mapping                                          │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### State 3: Form Saving

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Save Configuration]  [Cancel]                                      │
│                      (Button shows "Saving..." with loading cursor) │
└─────────────────────────────────────────────────────────────────────┘
```

---

### State 4: Form Error

```
┌───────────────────────────────────────────────────────────────────┐
│ Setup QloApps Connection                                          │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✗ Error: Invalid baseUrl format                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ QloApps Base URL *                                              │
│ [invalid                                                ]        │
│                                                                   │
│ ... other fields ...                                             │
│                                                                   │
│ [Save Configuration]  [Cancel]                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────┘
```

---

### State 5: Configured (Success)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ■ QloApps Channel Manager                                            │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │                                                               │  │
│ │  🟢 QloApps                              ✓ Connected         │  │
│ │                                                               │  │
│ │  Open-source hotel management and booking engine. Syncs      │  │
│ │  reservations, availability, and room rates automatically.   │  │
│ │                                                               │  │
│ │  [Edit Connection]  [Test Connection]                        │  │
│ │                                                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ ✓ Sync Features                                               │  │
│ │ ✓ Automatic reservation sync (create, update, cancel)        │  │
│ │ ✓ Room availability updates                                  │  │
│ │ ✓ Rate synchronization                                       │  │
│ │ ✓ Room type mapping                                          │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ✓ Toast: "QloApps configuration saved successfully"                │
│                                                 [×]                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### State 6: Test Connection - Testing

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Edit Connection]  [⟳ Testing...]                                  │
│                      (Button shows spinner animation)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

### State 7: Test Connection - Success

```
┌─────────────────────────────────────────────────────────────────────┐
│ Toast: "✓ QloApps connection successful!"                          │
│                                                                 [×]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### State 8: Test Connection - Failure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Toast: "✗ QloApps connection failed: [Error message]"              │
│                                                                 [×]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### State 9: Edit Connection Form

```
┌───────────────────────────────────────────────────────────────────┐
│ Edit QloApps Connection                                           │
│                                                                   │
│ QloApps Base URL *                                              │
│ [https://hotel.qloapps.com                      ]               │
│                                                                   │
│ QloApps Hotel ID *                                              │
│ [123                                             ]              │
│                                                                   │
│ WebService API Key *                                            │
│ [                                                ]              │
│ (Empty - leave blank to keep current)                           │
│                                                                   │
│ Sync Interval (minutes)                                         │
│ [30 minutes                            ▼         ]              │
│                                                                   │
│ [Save Configuration]  [Cancel]                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Form Inputs Detail

### QloApps Base URL
```
┌─────────────────────────────────────────────────┐
│ QloApps Base URL *                              │
│ [https://hotel.qloapps.com                      │
│  https://my-hotel-instance.qloapps.com          │
│  https://qloapps.company.com             ] ← Supports autocomplete
│
│ Examples:
│ ✓ https://hotel.qloapps.com
│ ✓ https://my-instance.qloapps.com
│ ✗ hotel.qloapps.com (missing https://)
│ ✗ https://hotel.qloapps.com/ (trailing slash)
└─────────────────────────────────────────────────┘
```

### Hotel ID
```
┌─────────────────────────────────┐
│ QloApps Hotel ID *              │
│ [123                           ]│
│                                 │
│ Numeric input:                  │
│ ✓ Positive integers only        │
│ ✗ Rejects: 0, -5, abc           │
└─────────────────────────────────┘
```

### API Key
```
┌───────────────────────────────────────────────┐
│ WebService API Key *                          │
│ [•••••••••••••••••••••••••••••••   ] ← Masked │
│                                               │
│ Password input (masked):                      │
│ - Shows as dots (•••)                         │
│ - Actual value not visible                    │
│ - Never sent in plain text                    │
│ - Encrypted before storage                    │
└───────────────────────────────────────────────┘
```

### Sync Interval
```
┌─────────────────────────────────┐
│ Sync Interval (minutes)         │
│ [5 minutes       ▼              │ ← Dropdown
│  10 minutes                      │
│  15 minutes ← Default           │
│  30 minutes                      │
│  60 minutes                      │
│ ]                               │
└─────────────────────────────────┘
```

---

## Button States

### Setup Connection Button
```
Not Configured:
┌──────────────────┐
│ Setup Connection │ ← Blue button, clickable
└──────────────────┘

Configured:
┌──────────────────┐
│ Edit Connection  │ ← Gray button, clickable
└──────────────────┘
```

### Test Connection Button
```
Idle:
┌─────────────────┐
│ Test Connection │ ← Purple button, clickable
└─────────────────┘

Testing:
┌──────────────────────────┐
│ ⟳ Testing...             │ ← Spinner, disabled
└──────────────────────────┘

Success:
Toast appears:
┌─────────────────────────────────┐
│ ✓ QloApps connection successful! │
└─────────────────────────────────┘

Failure:
Toast appears:
┌────────────────────────────────────────┐
│ ✗ QloApps connection failed: [Error]   │
└────────────────────────────────────────┘
```

### Save Configuration Button
```
Ready:
┌────────────────────┐
│ Save Configuration │ ← Blue button, clickable
└────────────────────┘

Saving:
┌────────────────────┐
│ Saving...          │ ← Disabled, shows text change
└────────────────────┘

After Success:
Form closes → Status updates → Toast shows
```

---

## Responsive Design

The form is fully responsive:

**Desktop (>1024px):**
```
┌──────────────────────────────────────────────┐
│ QloApps Base URL *        Sync Interval      │
│ [          Base URL     ] [Dropdown       ]   │
└──────────────────────────────────────────────┘
```

**Tablet (768px-1024px):**
```
┌──────────────────────────────────────┐
│ QloApps Base URL *                   │
│ [          Base URL              ]   │
│                                      │
│ Sync Interval                        │
│ [Dropdown                        ]   │
└──────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────┐
│ QloApps Base URL *          │
│ [    Base URL           ]   │
│                             │
│ Sync Interval               │
│ [Dropdown              ]    │
└─────────────────────────────┘
```

---

## Color Scheme

| State | Color | Meaning |
|-------|-------|---------|
| Not Configured | Gray (⚪) | Inactive |
| Configured | Green (🟢) | Active |
| Setup Button | Blue | Primary action |
| Edit Button | Gray | Secondary action |
| Test Button | Purple | Special action |
| Success Toast | Green (✓) | Success state |
| Error Toast | Red (✗) | Error state |
| Error Box | Red with border | Form validation error |
| Info Box | Blue with border | Informational message |

---

## Keyboard Navigation

All form elements are keyboard accessible:

```
Tab order:
1. Setup/Edit Connection button
2. Test Connection button
3. Base URL input (when form visible)
4. Hotel ID input
5. API Key input
6. Sync Interval dropdown
7. Save Configuration button
8. Cancel button

Enter: Submit form
Escape: Close form (when in form)
```

---

## Accessibility

- **ARIA Labels**: All inputs have clear labels
- **Error Messages**: Screen reader compatible
- **Keyboard Navigation**: Full support
- **Contrast Ratios**: WCAG AA compliant
- **Form Validation**: Clear feedback messages
- **Loading States**: Indicated with spinner and text

---

## Summary

The UI provides:
✓ Clear visual feedback for all states
✓ Intuitive form for configuration
✓ Error handling with helpful messages
✓ Loading states to prevent duplicate submissions
✓ Success confirmation via toast
✓ Responsive design for all devices
✓ Accessible to keyboard and screen readers
