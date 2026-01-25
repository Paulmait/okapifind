# Base Camp (Hotel) Feature - QA Checklist

## Overview
This document provides a comprehensive QA checklist for the Base Camp (Hotel) feature implementation in OkapiFind.

---

## 1. Hotel Management

### Set Hotel Flow
- [ ] Can set hotel via search (Places API)
- [ ] Can set hotel via current location (pin drop)
- [ ] Search debouncing works (300ms delay)
- [ ] Low accuracy location readings are handled gracefully
- [ ] Hotel is saved to local cache (offline support)
- [ ] Hotel syncs to Supabase when online
- [ ] Setting a new hotel replaces the old one (no duplicates)
- [ ] Cancel button works correctly
- [ ] Loading states are shown during save

### Saved Places Screen
- [ ] Hotel section displays correctly when hotel is set
- [ ] "Set Hotel" button shows when no hotel is set
- [ ] "Take me to Hotel" button navigates to guidance
- [ ] "Change Hotel" button opens SetHotel screen
- [ ] Non-hotel places list displays correctly
- [ ] Delete confirmation dialog appears
- [ ] Navigate button starts guidance to place
- [ ] Pull-to-refresh works
- [ ] Empty state shows when no places saved

### Hotel Uniqueness (Database)
- [ ] Only one active hotel per user
- [ ] Setting new hotel deactivates previous
- [ ] Hotel atomically replaced (no orphaned hotels)
- [ ] RLS policies prevent unauthorized access

---

## 2. Navigation Integration

### Map Screen
- [ ] "Take me to Hotel" button visible when hotel set
- [ ] Hotel pill shows on map with distance/direction
- [ ] Saved places button opens SavedPlaces screen
- [ ] Hotel quick access buttons positioned correctly
- [ ] Buttons don't overlap with map controls

### Guidance Screen
- [ ] Can navigate to hotel destination
- [ ] Destination type 'hotel' handled correctly
- [ ] Arrival notification works
- [ ] Distance updates during navigation

---

## 3. Smart Suggestions (Opt-in)

### Settings
- [ ] Smart Suggestions toggle defaults to OFF
- [ ] Toggle persists across app restarts
- [ ] Setting syncs to Zustand store

### Stationary Detection
- [ ] Monitoring starts when map focused AND enabled
- [ ] Monitoring stops when map loses focus
- [ ] Monitoring stops when app goes to background
- [ ] Low accuracy readings are rejected (>100m)
- [ ] Stationary threshold works (3 minutes)
- [ ] Radius check works (50m movement resets)

### Save Place Sheet
- [ ] Sheet appears after stationary threshold
- [ ] Place name input works
- [ ] Place type selector works (Hotel/Favorite/Custom)
- [ ] Save button saves correctly
- [ ] "Not now" dismisses sheet
- [ ] "Don't ask here" adds to exclusion list
- [ ] Location exclusion persists

### Cooldowns & Limits
- [ ] 30-minute cooldown between suggestions
- [ ] No suggestion when near existing saved place
- [ ] Cooldown resets appropriately

---

## 4. Voice Guidance (Opt-in)

### Settings
- [ ] Voice guidance toggle defaults to OFF
- [ ] Auto-enable with headphones toggle works
- [ ] Settings persist across restarts

### Headphone Detection
- [ ] Detects AirPods connection
- [ ] Detects Bluetooth headphones
- [ ] Detects wired headphones
- [ ] Auto-enables voice when headphones connect (if setting enabled)

### Speech
- [ ] Maneuver instructions speak correctly
- [ ] Distance included for upcoming turns
- [ ] Street names included when available
- [ ] Arrival announcement works
- [ ] "Returning to hotel" announcement works

### Deduplication
- [ ] Same instruction not repeated within 10 seconds
- [ ] Case-insensitive matching works
- [ ] Different instructions play normally

### Queue Management
- [ ] Urgent messages prioritized
- [ ] Queue clears when voice disabled
- [ ] Stop function interrupts current speech

---

## 5. Return to Hotel Suggestions (Opt-in)

### Settings
- [ ] Return to hotel toggle defaults to OFF
- [ ] Toggle persists across restarts

### Trigger Conditions
- [ ] Triggers when far from hotel (>1 mile)
- [ ] Triggers during evening hours (8 PM - 6 AM)
- [ ] Triggers after navigation ends
- [ ] No trigger when near hotel (<200m)
- [ ] 30-minute cooldown between suggestions

### Return Sheet
- [ ] Sheet appears with hotel info
- [ ] Distance displayed correctly
- [ ] "Start Navigation" button works
- [ ] "Not now" dismisses
- [ ] "Don't ask again" persists preference

---

## 6. Offline Support

### Local Cache
- [ ] Saved places cached in AsyncStorage
- [ ] Cache loads on app start
- [ ] Cache updates on changes
- [ ] Works offline after initial load

### Sync
- [ ] Changes sync when online
- [ ] Conflict resolution works
- [ ] Network errors handled gracefully

---

## 7. Accessibility

### Voice Over / TalkBack
- [ ] All buttons have accessibility labels
- [ ] Accessibility roles set correctly
- [ ] Focus order is logical
- [ ] Announcements are clear

### Visual
- [ ] Text contrast meets WCAG AA
- [ ] Touch targets are 44x44 minimum
- [ ] Color is not only indicator

---

## 8. App Store Compliance

### Privacy
- [ ] Location only used in foreground
- [ ] No background location access
- [ ] All features opt-in
- [ ] No silent data collection

### User Consent
- [ ] Smart suggestions disabled by default
- [ ] Voice guidance disabled by default
- [ ] Return suggestions disabled by default
- [ ] Clear settings labels

### Stability
- [ ] No crashes during normal use
- [ ] Handles permission denial gracefully
- [ ] Memory usage is reasonable

---

## 9. Edge Cases

### Location
- [ ] Handles location permission denied
- [ ] Handles location timeout
- [ ] Handles very inaccurate GPS
- [ ] Handles location in motion

### Network
- [ ] Handles offline gracefully
- [ ] Handles slow network
- [ ] Handles Supabase errors
- [ ] Handles Places API errors

### User Actions
- [ ] Handles rapid button taps
- [ ] Handles screen rotation
- [ ] Handles app backgrounding during save
- [ ] Handles logout/login

---

## Test Devices

- [ ] iPhone (iOS 16+)
- [ ] iPad (iOS 16+)
- [ ] Android Phone (API 24+)
- [ ] Android Tablet

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Product | | | |

---

## Notes

_Add any additional notes, known issues, or test observations here._
