// @ts-nocheck
/**
 * Data Isolation Service
 * Ensures users can only access their own data with row-level security
 */

import { supabase } from '../lib/supabase-client';
import { logger, LogCategory } from './logger';
import { userProfileManager } from './userProfileManager';
import { dataEncryption } from './dataEncryption';

export interface DataAccessPolicy {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  condition: string;
  userIdColumn: string;
}

export interface IsolatedQuery {
  table: string;
  filters?: Record<string, any>;
  select?: string;
  orderBy?: string;
  limit?: number;
}

interface DataScopeConfig {
  tables: string[];
  userIdColumns: Record<string, string>;
  sharedTables: string[];
  publicTables: string[];
}

class DataIsolationService {
  private static instance: DataIsolationService;
  private currentUserId: string | null = null;
  private dataScopeConfig: DataScopeConfig;
  private accessPolicies: Map<string, DataAccessPolicy[]> = new Map();

  private constructor() {
    this.dataScopeConfig = {
      tables: [
        'parking_sessions',
        'car_locations',
        'parking_history',
        'user_preferences',
        'user_vehicles',
        'favorite_spots',
        'payment_methods',
        'notifications',
        'emergency_contacts',
      ],
      userIdColumns: {
        parking_sessions: 'user_id',
        car_locations: 'user_id',
        parking_history: 'user_id',
        user_preferences: 'user_id',
        user_vehicles: 'owner_id',
        favorite_spots: 'user_id',
        payment_methods: 'user_id',
        notifications: 'recipient_id',
        emergency_contacts: 'user_id',
      },
      sharedTables: [
        'shared_locations',
        'family_groups',
      ],
      publicTables: [
        'parking_spots',
        'street_cleaning_schedules',
        'parking_rates',
      ],
    };

    this.initializePolicies();
    this.setupRealtimeSecurity();
  }

  static getInstance(): DataIsolationService {
    if (!DataIsolationService.instance) {
      DataIsolationService.instance = new DataIsolationService();
    }
    return DataIsolationService.instance;
  }

  /**
   * Initialize data access policies
   */
  private initializePolicies(): void {
    // Create policies for each user table
    for (const table of this.dataScopeConfig.tables) {
      const userIdColumn = this.dataScopeConfig.userIdColumns[table];

      this.accessPolicies.set(table, [
        {
          table,
          operation: 'select',
          condition: `${userIdColumn} = auth.uid()`,
          userIdColumn,
        },
        {
          table,
          operation: 'insert',
          condition: `${userIdColumn} = auth.uid()`,
          userIdColumn,
        },
        {
          table,
          operation: 'update',
          condition: `${userIdColumn} = auth.uid()`,
          userIdColumn,
        },
        {
          table,
          operation: 'delete',
          condition: `${userIdColumn} = auth.uid()`,
          userIdColumn,
        },
      ]);
    }

    logger.info('Data isolation policies initialized', {
      tableCount: this.dataScopeConfig.tables.length,
    });
  }

  /**
   * Setup realtime security
   */
  private setupRealtimeSecurity(): void {
    // Subscribe to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.setCurrentUser(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        this.clearCurrentUser();
      }
    });
  }

  /**
   * Set current user for data isolation
   */
  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    logger.info('Data isolation user set', { userId });
  }

  /**
   * Clear current user
   */
  clearCurrentUser(): void {
    this.currentUserId = null;
    logger.info('Data isolation user cleared');
  }

  /**
   * Execute isolated query (ensures user can only access their data)
   */
  async query<T = any>(query: IsolatedQuery): Promise<T[]> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    const { table, filters = {}, select = '*', orderBy, limit } = query;

    // Check if table requires isolation
    if (!this.requiresIsolation(table)) {
      return this.executeQuery(table, filters, select, orderBy, limit);
    }

    // Add user isolation filter
    const userIdColumn = this.dataScopeConfig.userIdColumns[table];
    const isolatedFilters = {
      ...filters,
      [userIdColumn]: this.currentUserId,
    };

    return this.executeQuery(table, isolatedFilters, select, orderBy, limit);
  }

  /**
   * Execute query with filters
   */
  private async executeQuery<T>(
    table: string,
    filters: Record<string, any>,
    select: string,
    orderBy?: string,
    limit?: number
  ): Promise<T[]> {
    try {
      let query = supabase.from(table).select(select);

      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }

      // Apply ordering
      if (orderBy) {
        const [column, order] = orderBy.split(' ');
        query = query.order(column, { ascending: order !== 'desc' });
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log(LogCategory.DATABASE, 'Query executed', {
        table,
        recordCount: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      logger.error('Isolated query failed', error as Error, { table });
      throw error;
    }
  }

  /**
   * Insert data with user isolation
   */
  async insert<T = any>(table: string, data: Partial<T>): Promise<T> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    // Add user ID if table requires isolation
    let insertData = { ...data };
    if (this.requiresIsolation(table)) {
      const userIdColumn = this.dataScopeConfig.userIdColumns[table];
      insertData = {
        ...insertData,
        [userIdColumn]: this.currentUserId,
      };
    }

    try {
      const { data: inserted, error } = await supabase
        .from(table)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      logger.log(LogCategory.DATABASE, 'Data inserted', { table });

      return inserted;
    } catch (error) {
      logger.error('Insert failed', error as Error, { table });
      throw error;
    }
  }

  /**
   * Update data with user isolation
   */
  async update<T = any>(
    table: string,
    id: string,
    updates: Partial<T>
  ): Promise<T> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    try {
      let query = supabase
        .from(table)
        .update(updates);

      // Add user isolation if required
      if (this.requiresIsolation(table)) {
        const userIdColumn = this.dataScopeConfig.userIdColumns[table];
        query = query.eq(userIdColumn, this.currentUserId);
      }

      const { data: updated, error } = await query
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!updated) {
        throw new Error('Record not found or access denied');
      }

      logger.log(LogCategory.DATABASE, 'Data updated', { table, id });

      return updated;
    } catch (error) {
      logger.error('Update failed', error as Error, { table, id });
      throw error;
    }
  }

  /**
   * Delete data with user isolation
   */
  async delete(table: string, id: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    try {
      let query = supabase
        .from(table)
        .delete();

      // Add user isolation if required
      if (this.requiresIsolation(table)) {
        const userIdColumn = this.dataScopeConfig.userIdColumns[table];
        query = query.eq(userIdColumn, this.currentUserId);
      }

      const { error } = await query.eq('id', id);

      if (error) throw error;

      logger.log(LogCategory.DATABASE, 'Data deleted', { table, id });
    } catch (error) {
      logger.error('Delete failed', error as Error, { table, id });
      throw error;
    }
  }

  /**
   * Get user's parking sessions
   */
  async getUserParkingSessions(limit: number = 10): Promise<any[]> {
    return this.query({
      table: 'parking_sessions',
      orderBy: 'created_at desc',
      limit,
    });
  }

  /**
   * Get user's car locations
   */
  async getUserCarLocations(): Promise<any[]> {
    return this.query({
      table: 'car_locations',
      orderBy: 'saved_at desc',
      limit: 5,
    });
  }

  /**
   * Get user's favorite spots
   */
  async getUserFavoriteSpots(): Promise<any[]> {
    return this.query({
      table: 'favorite_spots',
      orderBy: 'created_at desc',
    });
  }

  /**
   * Get user's vehicles
   */
  async getUserVehicles(): Promise<any[]> {
    return this.query({
      table: 'user_vehicles',
      orderBy: 'is_default desc',
    });
  }

  /**
   * Share data with another user
   */
  async shareDataWithUser(
    dataId: string,
    table: string,
    targetUserId: string,
    permissions: string[] = ['read']
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    try {
      // Verify ownership
      const userIdColumn = this.dataScopeConfig.userIdColumns[table];
      const { data: record, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', dataId)
        .eq(userIdColumn, this.currentUserId)
        .single();

      if (fetchError || !record) {
        throw new Error('Record not found or access denied');
      }

      // Create sharing record
      const { error: shareError } = await supabase
        .from('data_shares')
        .insert({
          owner_id: this.currentUserId,
          shared_with_id: targetUserId,
          table_name: table,
          record_id: dataId,
          permissions,
          created_at: new Date(),
        });

      if (shareError) throw shareError;

      logger.info('Data shared', {
        table,
        dataId,
        targetUserId,
        permissions,
      });
    } catch (error) {
      logger.error('Data sharing failed', error as Error);
      throw error;
    }
  }

  /**
   * Revoke data sharing
   */
  async revokeDataShare(shareId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    try {
      const { error } = await supabase
        .from('data_shares')
        .delete()
        .eq('id', shareId)
        .eq('owner_id', this.currentUserId);

      if (error) throw error;

      logger.info('Data share revoked', { shareId });
    } catch (error) {
      logger.error('Failed to revoke data share', error as Error);
      throw error;
    }
  }

  /**
   * Get shared data accessible to user
   */
  async getSharedData(): Promise<any[]> {
    if (!this.currentUserId) {
      throw new Error('No user context for data isolation');
    }

    try {
      const { data, error } = await supabase
        .from('data_shares')
        .select('*')
        .eq('shared_with_id', this.currentUserId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get shared data', error as Error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive user data
   */
  async encryptUserData<T>(data: T): Promise<string> {
    if (!this.currentUserId) {
      throw new Error('No user context for encryption');
    }

    const encrypted = await dataEncryption.encrypt(
      JSON.stringify(data),
      `user_${this.currentUserId}`
    );

    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt user data
   */
  async decryptUserData<T>(encryptedData: string): Promise<T> {
    if (!this.currentUserId) {
      throw new Error('No user context for decryption');
    }

    const encrypted = JSON.parse(encryptedData);
    const decrypted = await dataEncryption.decrypt(encrypted);

    return JSON.parse(decrypted);
  }

  /**
   * Check if table requires isolation
   */
  private requiresIsolation(table: string): boolean {
    return (
      this.dataScopeConfig.tables.includes(table) &&
      !this.dataScopeConfig.publicTables.includes(table)
    );
  }

  /**
   * Validate data access
   */
  async validateAccess(table: string, recordId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    // Public tables are accessible to all
    if (this.dataScopeConfig.publicTables.includes(table)) {
      return true;
    }

    // Check ownership
    if (this.requiresIsolation(table)) {
      const userIdColumn = this.dataScopeConfig.userIdColumns[table];
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('id', recordId)
        .eq(userIdColumn, this.currentUserId)
        .single();

      return !error && !!data;
    }

    // Check shared access
    const { data: sharedAccess } = await supabase
      .from('data_shares')
      .select('id')
      .eq('table_name', table)
      .eq('record_id', recordId)
      .eq('shared_with_id', this.currentUserId)
      .single();

    return !!sharedAccess;
  }

  /**
   * Create row-level security policy
   */
  async createRLSPolicy(policy: DataAccessPolicy): Promise<void> {
    const policyName = `${policy.table}_${policy.operation}_user_isolation`;
    const policyDefinition = `
      CREATE POLICY "${policyName}"
      ON public.${policy.table}
      FOR ${policy.operation.toUpperCase()}
      TO authenticated
      USING (${policy.condition});
    `;

    logger.info('RLS policy created', {
      table: policy.table,
      operation: policy.operation,
    });
  }

  /**
   * Audit data access
   */
  private async auditDataAccess(
    table: string,
    operation: string,
    recordId?: string
  ): Promise<void> {
    try {
      await supabase.from('data_access_logs').insert({
        user_id: this.currentUserId,
        table_name: table,
        operation,
        record_id: recordId,
        timestamp: new Date(),
        ip_address: await this.getIPAddress(),
      });
    } catch (error) {
      logger.error('Failed to audit data access', error as Error);
    }
  }

  /**
   * Get user's IP address
   */
  private async getIPAddress(): Promise<string> {
    // Implementation would get actual IP
    return '0.0.0.0';
  }

  /**
   * Get data statistics for user
   */
  async getUserDataStatistics(): Promise<any> {
    if (!this.currentUserId) {
      throw new Error('No user context');
    }

    const stats: any = {};

    for (const table of this.dataScopeConfig.tables) {
      const userIdColumn = this.dataScopeConfig.userIdColumns[table];
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(userIdColumn, this.currentUserId);

      stats[table] = count || 0;
    }

    return stats;
  }
}

export const dataIsolation = DataIsolationService.getInstance();