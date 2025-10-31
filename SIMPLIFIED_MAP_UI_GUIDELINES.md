# Simplified Map UI Guidelines
**Phase 2 Feature: Simplified Map Interface**
**Objective:** 90% more map visibility, cleaner UI, better UX

---

## 🎯 Problem Statement

**Current Issues:**
- Map is cluttered with buttons and controls
- Only ~40% of screen shows map
- Important actions hidden in menus
- Overwhelming for new users

**Solution:**
- Full-screen map (90% visibility)
- Single "Park Here" FAB (Floating Action Button)
- Bottom sheet for all other features
- Clean, minimal interface

---

## 📐 Layout Structure

### 1. Full-Screen Map (90% of screen)

```
┌─────────────────────────────────┐
│  [⚙️]               [📍]  [👤] │ ← Minimal top bar
│                                 │
│                                 │
│          MAP AREA               │
│         (90% screen)            │
│                                 │
│                                 │
│         [User Pin 📍]           │
│         [Car Pin 🚗]            │
│                                 │
│                                 │
│                                 │
│     [🅿️ Park Here] ← FAB       │
│                                 │
│  ═══════════════════════════    │ ← Bottom sheet handle
│  Quick Actions                   │
│  • Add landmark photo            │
│  • Set timer                     │
└─────────────────────────────────┘
```

---

## 🎨 Components

### 1. Minimal Top Bar (60px height)

**Left Side:**
- Settings icon (gear) - top-left corner
- Transparent background

**Right Side:**
- Recenter button (location icon)
- Profile/Menu button

**Style:**
```typescript
{
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  backgroundColor: 'transparent',
  paddingHorizontal: 16,
  paddingTop: StatusBar.currentHeight,
  flexDirection: 'row',
  justifyContent: 'space-between',
}
```

---

### 2. Floating Action Button (FAB)

**Primary Action:** "Park Here" button

**Position:**
- Bottom-right corner
- 80px from bottom
- 24px from right edge

**States:**
1. **No Car Saved:**
   - Large blue circle
   - "🅿️ Park Here" text
   - Pulsing animation

2. **Car Already Saved:**
   - Green circle
   - "✓ Parked" text
   - Static (no pulse)

**Style:**
```typescript
{
  position: 'absolute',
  bottom: 80,
  right: 24,
  width: 120,
  height: 120,
  borderRadius: 60,
  backgroundColor: '#4A90E2',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 8,
}
```

---

### 3. Bottom Sheet

**Purpose:** Contains all secondary actions

**Behavior:**
- Swipe up to expand
- Swipe down to collapse
- 3 snap points: collapsed (20%), half (50%), full (90%)

**Collapsed State (20%):**
Shows quick actions:
- ✅ Current parking status
- 📸 Add landmark photo
- ⏰ Set timer
- 🧭 Navigate to car

**Half State (50%):**
Shows:
- Parking details
- History (last 5 sessions)
- Quick actions

**Full State (90%):**
Shows:
- Complete history
- Settings
- Help & support

**Implementation:**
```typescript
import { BottomSheet } from '@gorhom/bottom-sheet';

const snapPoints = useMemo(() => ['20%', '50%', '90%'], []);

<BottomSheet
  ref={bottomSheetRef}
  index={0} // Start collapsed
  snapPoints={snapPoints}
  enablePanDownToClose={false}
>
  <BottomSheetContent />
</BottomSheet>
```

---

## 📱 Screen Breakdown

### MapScreen Simplified Layout

**File:** `src/screens/MapScreen.tsx`

```typescript
export const MapScreen = () => {
  return (
    <View style={styles.container}>
      {/* 1. Full-screen map */}
      <MapView style={styles.map}>
        {/* User location marker */}
        <Marker coordinate={userLocation} />

        {/* Car location marker (if saved) */}
        {carLocation && (
          <Marker coordinate={carLocation} />
        )}
      </MapView>

      {/* 2. Minimal top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={openSettings}>
          <Ionicons name="settings-outline" size={24} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={recenterMap}>
            <Ionicons name="locate" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openProfile}>
            <Ionicons name="person-circle-outline" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. FAB - Park Here button */}
      <QuickParkButton
        onSuccess={() => bottomSheetRef.current?.snapToIndex(1)}
      />

      {/* 4. Bottom sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={['20%', '50%', '90%']}
      >
        <BottomSheetView>
          {/* Quick actions in collapsed state */}
          <QuickActions />

          {/* Details in half/full states */}
          {sheetIndex > 0 && <ParkingDetails />}
          {sheetIndex === 2 && <FullHistory />}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};
```

---

## 🎯 Quick Actions Panel

**Contents (Bottom Sheet Collapsed):**

```
┌─────────────────────────────────┐
│  Parked at Walmart Lot, Floor 2 │ ← Current status
├─────────────────────────────────┤
│  [📸] Add Landmark Photo         │
│  [⏰] Set Timer (2:00 PM)        │
│  [🧭] Navigate to Car            │
│  [📋] View History               │
└─────────────────────────────────┘
```

**Implementation:**
```typescript
const QuickActions = () => (
  <View style={styles.quickActions}>
    <StatusBar parkingSession={activeSession} />

    <TouchableOpacity style={styles.action}>
      <Ionicons name="camera" size={24} />
      <Text>Add Landmark Photo</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.action}>
      <Ionicons name="timer" size={24} />
      <Text>Set Timer</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.action}>
      <Ionicons name="navigate" size={24} />
      <Text>Navigate to Car</Text>
    </TouchableOpacity>
  </View>
);
```

---

## 🎨 Visual Design

### Color Palette

**Primary:**
- Map: Full-color satellite or streets
- FAB: `#4A90E2` (OkapiFind Blue)
- Success: `#4CAF50` (Green)
- Warning: `#FFC107` (Amber)

**Overlays:**
- Top bar: Transparent with white icons
- Bottom sheet: White background
- Shadows: `rgba(0, 0, 0, 0.1)` for depth

### Typography

**Top Bar Icons:**
- Size: 24px
- Color: `#333333` (Dark) or `#FFFFFF` (if map is dark)

**FAB Text:**
- Size: 16px
- Weight: 600 (Semi-bold)
- Color: `#FFFFFF`

**Bottom Sheet:**
- Headers: 18px, weight 600
- Body: 16px, weight 400
- Captions: 14px, weight 400, `#666666`

---

## 🔄 User Interactions

### Gestures

**Map:**
- ✅ Pinch to zoom
- ✅ Two-finger rotate
- ✅ Single-finger pan
- ✅ Double-tap to zoom in

**Bottom Sheet:**
- ✅ Swipe up to expand
- ✅ Swipe down to collapse
- ✅ Tap outside to collapse (half → collapsed)

**FAB:**
- ✅ Tap to save parking
- ✅ Long-press for options (manual location, etc.)

### Animations

**Map Transitions:**
- Recenter: Smooth camera animation (500ms)
- Show car: Zoom to fit both user and car (700ms)

**FAB:**
- Idle: Gentle pulse (1.0 → 1.1 scale, 2s loop)
- Press: Scale down to 0.9, then spring back
- Success: Checkmark animation + color change

**Bottom Sheet:**
- Snap: Spring animation (tension: 50, friction: 7)
- Content: Fade in when expanding

---

## 📊 Benefits

### Before Simplified UI:
- Map visibility: 40%
- Tap to save: 3-5 taps, 30 seconds
- New user confusion: High

### After Simplified UI:
- Map visibility: 90% ✅
- Tap to save: 1 tap, 2 seconds ✅
- New user onboarding: Intuitive ✅

### Expected Impact:
- 📈 User activation: +50%
- 📈 Feature discovery: +80% (bottom sheet)
- 📈 User satisfaction: +40%
- 📉 Support requests: -30%

---

## 🛠️ Implementation Checklist

### Phase 1: Core Layout
- [ ] Remove all buttons from map area
- [ ] Implement full-screen map
- [ ] Add minimal top bar
- [ ] Create FAB component

### Phase 2: Bottom Sheet
- [ ] Install `@gorhom/bottom-sheet`
- [ ] Implement bottom sheet with 3 snap points
- [ ] Add quick actions panel
- [ ] Add parking details panel

### Phase 3: Animations
- [ ] FAB pulse animation
- [ ] Bottom sheet snap animation
- [ ] Map camera animations
- [ ] Success animations

### Phase 4: Polish
- [ ] Test on different screen sizes
- [ ] Accessibility (VoiceOver)
- [ ] Haptic feedback
- [ ] Error states

---

## 📝 Code Examples

### Install Bottom Sheet
```bash
npm install @gorhom/bottom-sheet@^4
```

### Minimal MapScreen Template

```typescript
import React, { useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { QuickParkButton } from '../components/QuickParkButton';
import { TopBar } from '../components/TopBar';

export const MapScreen = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['20%', '50%', '90%'], []);

  return (
    <View style={styles.container}>
      <MapView style={styles.map}>
        {/* Markers */}
      </MapView>

      <TopBar />
      <QuickParkButton />

      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
      >
        {/* Content */}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
```

---

## 🎯 Success Metrics

**Track these metrics after implementation:**

1. **Map Visibility:** % of screen showing map
   - Target: >85%

2. **Time to Park:** Seconds from screen load to save
   - Target: <5 seconds

3. **Feature Discovery:** % of users who use quick actions
   - Target: >60%

4. **User Satisfaction:** App store rating
   - Target: 4.5+ stars

5. **Support Requests:** Tickets about "can't find save button"
   - Target: -50%

---

## 🚀 Next Steps

1. Review these guidelines with design team
2. Create Figma mockups (optional)
3. Implement Phase 1 (core layout)
4. User testing with 5 beta users
5. Iterate based on feedback
6. Full rollout

---

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Author:** Claude Code - Phase 2 Implementation
