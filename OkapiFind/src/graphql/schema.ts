/**
 * GraphQL Schema Definition
 * Defines the complete API schema for OkapiFind
 */

import { buildSchema } from 'type-graphql';
import { UserResolver } from './resolvers/UserResolver';
// TODO: Implement missing resolvers
// import { ParkingResolver } from './resolvers/ParkingResolver';
// import { NavigationResolver } from './resolvers/NavigationResolver';
// import { SubscriptionResolver } from './resolvers/SubscriptionResolver';
// import { AnalyticsResolver } from './resolvers/AnalyticsResolver';
// import { SafetyResolver } from './resolvers/SafetyResolver';

export async function createSchema() {
  return await buildSchema({
    resolvers: [
      UserResolver,
      // TODO: Add remaining resolvers when implemented
      // ParkingResolver,
      // NavigationResolver,
      // SubscriptionResolver,
      // AnalyticsResolver,
      // SafetyResolver,
    ],
    validate: true,
    authChecker: ({ context }) => {
      return !!context.user;
    },
  });
}

export const typeDefs = `
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
    name: String
    photoURL: String
    isPremium: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    preferences: UserPreferences!
    stats: UserStats!
  }

  type UserPreferences {
    notifications: Boolean!
    darkMode: Boolean!
    language: String!
    measurementUnit: String!
    voiceGuidance: Boolean!
    autoSaveLocation: Boolean!
    safetyMode: Boolean!
  }

  type UserStats {
    totalParkingSessions: Int!
    totalDistanceWalked: Float!
    averageParkingDuration: Float!
    favoriteLocations: [Location!]!
  }

  type Location {
    id: ID!
    latitude: Float!
    longitude: Float!
    address: String
    name: String
    type: LocationType!
    savedAt: DateTime
    notes: String
    photos: [Photo!]
  }

  type Photo {
    id: ID!
    url: String!
    thumbnailUrl: String!
    caption: String
    takenAt: DateTime!
  }

  enum LocationType {
    PARKING
    HOME
    WORK
    FAVORITE
    RECENT
  }

  type ParkingSession {
    id: ID!
    userId: ID!
    startTime: DateTime!
    endTime: DateTime
    location: Location!
    duration: Int
    cost: Float
    notes: String
    photos: [Photo!]
    reminder: ParkingReminder
    status: ParkingStatus!
  }

  type ParkingReminder {
    id: ID!
    time: DateTime!
    message: String!
    sent: Boolean!
  }

  enum ParkingStatus {
    ACTIVE
    COMPLETED
    EXPIRED
    CANCELLED
  }

  type NavigationRoute {
    id: ID!
    origin: Location!
    destination: Location!
    distance: Float!
    duration: Int!
    steps: [NavigationStep!]!
    mode: NavigationMode!
    arEnabled: Boolean!
  }

  type NavigationStep {
    instruction: String!
    distance: Float!
    duration: Int!
    maneuver: String!
    coordinates: Location!
  }

  enum NavigationMode {
    WALKING
    DRIVING
    TRANSIT
    AR
  }

  type Subscription {
    id: ID!
    userId: ID!
    plan: SubscriptionPlan!
    status: SubscriptionStatus!
    startDate: DateTime!
    endDate: DateTime
    autoRenew: Boolean!
    paymentMethod: String
  }

  enum SubscriptionPlan {
    FREE
    MONTHLY
    YEARLY
    LIFETIME
  }

  enum SubscriptionStatus {
    ACTIVE
    CANCELLED
    EXPIRED
    TRIAL
  }

  type Analytics {
    daily: DailyAnalytics!
    weekly: WeeklyAnalytics!
    monthly: MonthlyAnalytics!
    predictions: PredictionData!
  }

  type DailyAnalytics {
    date: DateTime!
    sessions: Int!
    avgDuration: Float!
    locations: [Location!]!
  }

  type WeeklyAnalytics {
    weekStart: DateTime!
    weekEnd: DateTime!
    totalSessions: Int!
    totalDuration: Float!
    mostFrequentLocation: Location
  }

  type MonthlyAnalytics {
    month: String!
    year: Int!
    totalSessions: Int!
    totalCost: Float!
    savings: Float!
  }

  type PredictionData {
    nextParkingTime: DateTime
    recommendedSpots: [Location!]!
    congestionLevel: String!
    estimatedCost: Float
  }

  type SafetyAlert {
    id: ID!
    userId: ID!
    type: SafetyAlertType!
    location: Location!
    message: String!
    createdAt: DateTime!
    resolved: Boolean!
    contacts: [EmergencyContact!]!
  }

  enum SafetyAlertType {
    PANIC
    LOCATION_SHARE
    CHECK_IN
    TIMER_EXPIRED
  }

  type EmergencyContact {
    id: ID!
    name: String!
    phone: String!
    email: String
    relationship: String
  }

  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!

    # Parking queries
    currentParkingSession: ParkingSession
    parkingHistory(limit: Int, offset: Int): [ParkingSession!]!
    parkingSession(id: ID!): ParkingSession
    nearbyParkingSpots(latitude: Float!, longitude: Float!, radius: Float!): [Location!]!

    # Navigation queries
    route(originLat: Float!, originLng: Float!, destLat: Float!, destLng: Float!, mode: NavigationMode): NavigationRoute
    savedRoutes: [NavigationRoute!]!

    # Subscription queries
    mySubscription: Subscription
    availablePlans: [SubscriptionPlan!]!

    # Analytics queries
    myAnalytics(period: String!): Analytics
    parkingPredictions: PredictionData

    # Safety queries
    activeAlerts: [SafetyAlert!]!
    emergencyContacts: [EmergencyContact!]!
  }

  type Mutation {
    # User mutations
    updateProfile(name: String, photoURL: String): User
    updatePreferences(preferences: UserPreferencesInput!): User
    deleteAccount: Boolean

    # Parking mutations
    startParkingSession(location: LocationInput!, notes: String): ParkingSession
    endParkingSession(sessionId: ID!): ParkingSession
    addParkingPhoto(sessionId: ID!, photo: PhotoInput!): ParkingSession
    setParkingReminder(sessionId: ID!, time: DateTime!, message: String): ParkingSession

    # Location mutations
    saveLocation(location: LocationInput!, name: String, type: LocationType!): Location
    deleteLocation(id: ID!): Boolean
    updateLocation(id: ID!, name: String, notes: String): Location

    # Navigation mutations
    saveRoute(route: NavigationRouteInput!): NavigationRoute
    deleteRoute(id: ID!): Boolean

    # Subscription mutations
    upgradeToPremium(plan: SubscriptionPlan!): Subscription
    cancelSubscription: Subscription
    restorePurchases: Subscription

    # Safety mutations
    triggerPanicAlert(location: LocationInput!, message: String): SafetyAlert
    shareLocation(contacts: [ID!]!, duration: Int!): SafetyAlert
    resolveAlert(alertId: ID!): SafetyAlert
    addEmergencyContact(contact: EmergencyContactInput!): EmergencyContact
    removeEmergencyContact(id: ID!): Boolean
  }

  type Subscription {
    # Real-time subscriptions
    parkingSessionUpdated(userId: ID!): ParkingSession
    locationShared(userId: ID!): Location
    alertTriggered(userId: ID!): SafetyAlert
    navigationProgress(sessionId: ID!): NavigationStep
  }

  input UserPreferencesInput {
    notifications: Boolean
    darkMode: Boolean
    language: String
    measurementUnit: String
    voiceGuidance: Boolean
    autoSaveLocation: Boolean
    safetyMode: Boolean
  }

  input LocationInput {
    latitude: Float!
    longitude: Float!
    address: String
    name: String
  }

  input PhotoInput {
    url: String!
    caption: String
  }

  input NavigationRouteInput {
    originLat: Float!
    originLng: Float!
    destLat: Float!
    destLng: Float!
    mode: NavigationMode!
  }

  input EmergencyContactInput {
    name: String!
    phone: String!
    email: String
    relationship: String
  }
`;