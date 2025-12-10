/**
 * User GraphQL Resolver
 * Handles all user-related queries and mutations
 */

import { Resolver, Query, Mutation, Arg, Ctx, Authorized, Int } from 'type-graphql';
import { User, UserPreferences } from '../types/User';
import { userService } from '../../services/userService';
import type { Context } from '../context';

@Resolver(User)
export class UserResolver {
  @Query(() => User, { nullable: true })
  @Authorized()
  async me(@Ctx() ctx: Context): Promise<User | null> {
    if (!ctx.user) return null;
    return await userService.getUserById(ctx.user.id);
  }

  @Query(() => User, { nullable: true })
  @Authorized()
  async user(@Arg('id') id: string): Promise<User | null> {
    return await userService.getUserById(id);
  }

  @Query(() => [User])
  @Authorized('ADMIN')
  async users(
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number,
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number
  ): Promise<User[]> {
    return await userService.getUsers({ limit, offset });
  }

  @Mutation(() => User)
  @Authorized()
  async updateProfile(
    @Arg('name', { nullable: true }) name: string,
    @Arg('photoURL', { nullable: true }) photoURL: string,
    @Ctx() ctx: Context
  ): Promise<User> {
    if (!ctx.user) throw new Error('User not authenticated');
    return await userService.updateProfile(ctx.user.id, { name, photoURL });
  }

  @Mutation(() => User)
  @Authorized()
  async updatePreferences(
    @Arg('preferences') preferences: UserPreferences,
    @Ctx() ctx: Context
  ): Promise<User> {
    if (!ctx.user) throw new Error('User not authenticated');
    return await userService.updatePreferences(ctx.user.id, preferences);
  }

  @Mutation(() => Boolean)
  @Authorized()
  async deleteAccount(@Ctx() ctx: Context): Promise<boolean> {
    if (!ctx.user) throw new Error('User not authenticated');
    await userService.deleteUser(ctx.user.id);
    return true;
  }
}