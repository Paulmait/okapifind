/**
 * User Type Definitions for GraphQL
 */

import { ObjectType, Field, ID, InputType } from 'type-graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  photoURL?: string;

  @Field(() => UserStats)
  stats!: UserStats;

  @Field(() => UserPreferences)
  preferences!: UserPreferences;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  lastActive?: Date;

  @Field()
  isPremium!: boolean;

  @Field({ nullable: true })
  subscriptionExpiresAt?: Date;
}

@ObjectType()
export class UserStats {
  @Field()
  totalSessions!: number;

  @Field()
  totalPhotos!: number;

  @Field()
  totalTimers!: number;

  @Field()
  averageSessionDuration!: number;

  @Field()
  longestParkingSession!: number;
}

@InputType()
export class UserPreferences {
  @Field({ nullable: true })
  notificationsEnabled?: boolean;

  @Field({ nullable: true })
  soundEnabled?: boolean;

  @Field({ nullable: true })
  vibrationEnabled?: boolean;

  @Field({ nullable: true })
  defaultTimerMinutes?: number;

  @Field({ nullable: true })
  theme?: string;

  @Field({ nullable: true })
  language?: string;

  @Field({ nullable: true })
  distanceUnit?: string;

  @Field({ nullable: true })
  autoStartTimer?: boolean;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  photoURL?: string;

  @Field({ nullable: true })
  preferences?: UserPreferences;
}