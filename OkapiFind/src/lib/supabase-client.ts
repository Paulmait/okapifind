/**
 * Supabase Client for OkapiFind
 * Production-grade integration with Expo/React Native
 */

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import Constants from 'expo-constants'

// Types matching our database schema
export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  units: 'imperial' | 'metric'
  haptics_enabled: boolean
  voice_enabled: boolean
  safety_default: boolean
  premium: boolean
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  user_id: string
  label: string
  plate?: string
  color?: string
  make?: string
  model?: string
  is_default: boolean
  created_at: string
}

export interface ParkingSession {
  id: string
  user_id: string
  vehicle_id?: string
  car_point: { coordinates: [number, number] }
  car_address?: string
  saved_at: string
  source: 'auto' | 'manual' | 'photo' | 'quick_park_button'
  floor?: string
  venue_id?: string
  venue_name?: string
  notes?: string
  found_at?: string
  is_active: boolean
  created_at: string
}

export interface MeterPhoto {
  id: string
  session_id: string
  image_path: string
  ocr_text?: string
  rules_json?: any
  expires_at?: string
  processed_at?: string
  created_at: string
}

export interface Timer {
  id: string
  session_id: string
  notify_at: string
  buffer_seconds: number
  status: 'scheduled' | 'fired' | 'canceled' | 'snoozed'
  created_at: string
}

export interface SafetyShare {
  id: string
  session_id: string
  created_by: string
  share_token: string
  expires_at: string
  active: boolean
  created_at: string
}

// Initialize Supabase client with AsyncStorage for auth persistence
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ============================================
// PARKING SESSION FUNCTIONS
// ============================================

/**
 * Create a new parking session
 */
export async function createParkingSession(
  location: Location.LocationObject,
  options?: {
    vehicle_id?: string
    source?: 'auto' | 'manual' | 'photo'
    floor?: string
    notes?: string
    address?: string
    venue_name?: string
  }
) {
  const { data, error } = await supabase.rpc('create_parking_session', {
    p_lat: location.coords.latitude,
    p_lng: location.coords.longitude,
    p_vehicle_id: options?.vehicle_id,
    p_source: options?.source || 'manual',
    p_floor: options?.floor,
    p_notes: options?.notes,
    p_address: options?.address,
    p_venue_name: options?.venue_name,
  })

  if (error) throw error
  return data as string // Returns session ID
}

/**
 * End active parking session
 */
export async function endParkingSession(sessionId: string) {
  const { data, error } = await supabase.rpc('end_parking_session', {
    p_session_id: sessionId,
  })

  if (error) throw error
  return data as boolean
}

/**
 * Get active parking session
 */
export async function getActiveParkingSession() {
  const { data, error } = await supabase.rpc('get_active_parking_session')

  if (error) throw error
  return data ? data[0] : null
}

/**
 * Get parking session history
 */
export async function getParkingHistory(limit = 20) {
  const { data, error } = await supabase
    .from('parking_sessions')
    .select('*, vehicle:vehicles(*)')
    .order('saved_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

// ============================================
// METER PHOTO FUNCTIONS
// ============================================

/**
 * Upload meter photo and create record
 */
export async function uploadMeterPhoto(
  sessionId: string,
  imageUri: string,
  ocrData?: {
    text?: string
    rules?: any
    expires_at?: string
  }
) {
  try {
    // 1. Get signed upload URL from Edge Function
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
      'signed-upload',
      {
        body: {
          session_id: sessionId,
          content_type: 'image/jpeg',
          file_extension: 'jpg',
        },
      }
    )

    if (uploadError || !uploadData) {
      throw uploadError || new Error('Failed to get upload URL')
    }

    // 2. Upload image to signed URL
    const blob = await fetch(imageUri).then(r => r.blob())
    const uploadResponse = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: blob,
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image')
    }

    // 3. Create meter_photos record
    const { data: photoRecord, error: recordError } = await supabase
      .from('meter_photos')
      .insert({
        session_id: sessionId,
        image_path: uploadData.file_path,
        ocr_text: ocrData?.text,
        rules_json: ocrData?.rules,
        expires_at: ocrData?.expires_at,
        processed_at: ocrData ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (recordError) throw recordError

    return {
      ...photoRecord,
      view_url: uploadData.view_url,
    }
  } catch (error) {
    console.error('Meter photo upload error:', error)
    throw error
  }
}

// ============================================
// TIMER FUNCTIONS
// ============================================

/**
 * Set or update a parking timer
 */
export async function setParkingTimer(
  sessionId: string,
  notifyAt: Date,
  bufferMinutes: number = 10
) {
  const { data, error } = await supabase.rpc('upsert_timer', {
    p_session_id: sessionId,
    p_notify_at: notifyAt.toISOString(),
    p_buffer_seconds: bufferMinutes * 60,
  })

  if (error) throw error
  return data as string // Returns timer ID
}

/**
 * Cancel a parking timer
 */
export async function cancelTimer(timerId: string) {
  const { error } = await supabase
    .from('timers')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', timerId)

  if (error) throw error
}

// ============================================
// SAFETY MODE FUNCTIONS
// ============================================

/**
 * Start safety sharing session
 */
export async function startSafetyShare(
  sessionId: string,
  expiresInMinutes: number = 120,
  recipientInfo?: { phone?: string; name?: string }
) {
  const { data, error } = await supabase.functions.invoke('start-share', {
    body: {
      session_id: sessionId,
      expires_in: expiresInMinutes,
      recipient_info: recipientInfo,
    },
  })

  if (error) throw error
  return data as {
    share_id: string
    share_token: string
    share_url: string
    expires_at: string
  }
}

/**
 * Update safety share location
 */
export async function updateShareLocation(
  shareId: string,
  location: Location.LocationObject
) {
  const { error } = await supabase.from('share_locations').insert({
    share_id: shareId,
    at_point: {
      type: 'Point',
      coordinates: [location.coords.longitude, location.coords.latitude],
    },
    speed: location.coords.speed || null,
    heading: location.coords.heading || null,
    accuracy: location.coords.accuracy || null,
  })

  if (error) throw error
}

/**
 * End safety share
 */
export async function endSafetyShare(shareId: string) {
  const { error } = await supabase
    .from('safety_shares')
    .update({
      active: false,
    })
    .eq('id', shareId)

  if (error) throw error
}

// ============================================
// VEHICLE FUNCTIONS
// ============================================

/**
 * Get user's vehicles
 */
export async function getVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Add a vehicle
 */
export async function addVehicle(vehicle: {
  label: string
  plate?: string
  color?: string
  make?: string
  model?: string
  is_default?: boolean
}) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicle)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// USER SETTINGS FUNCTIONS
// ============================================

/**
 * Get user settings
 */
export async function getUserSettings() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .single()

  if (error && error.code !== 'PGRST116') throw error // Ignore not found
  return data
}

/**
 * Update user settings
 */
export async function updateUserSettings(settings: Partial<UserSettings>) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      ...settings,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// DEVICE MANAGEMENT
// ============================================

/**
 * Register device for push notifications
 */
export async function registerDevice(pushToken: string) {
  const platform = Platform.OS as 'ios' | 'android' | 'web'

  const { error } = await supabase.from('devices').upsert(
    {
      user_id: (await supabase.auth.getUser()).data.user?.id,
      platform,
      expo_push_token: pushToken,
      device_info: {
        os: Platform.OS,
        version: Platform.Version,
        model: Constants.deviceName,
      },
      last_seen_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,expo_push_token',
    }
  )

  if (error) throw error
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Log analytics event
 */
export async function logAnalyticsEvent(
  event: string,
  payload?: any
) {
  // Fire and forget - don't wait for response
  supabase
    .from('analytics_events')
    .insert({
      event,
      payload,
      platform: Platform.OS,
      session_id: Constants.sessionId,
    })
    .then(({ error }) => {
      if (error) console.warn('Analytics event failed:', error)
    })
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to safety share location updates
 */
export function subscribeToShareLocations(
  shareId: string,
  callback: (location: any) => void
) {
  return supabase
    .channel(`share-locations-${shareId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'share_locations',
        filter: `share_id=eq.${shareId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()
}

/**
 * Subscribe to timer updates
 */
export function subscribeToTimerUpdates(
  sessionId: string,
  callback: (timer: Timer) => void
) {
  return supabase
    .channel(`timers-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'timers',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        callback(payload.new as Timer)
      }
    )
    .subscribe()
}

export default supabase