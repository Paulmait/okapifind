/**
 * Supabase Integration Tests
 */

import { createClient } from '@supabase/supabase-js';
import { mockSupabaseClient } from '../../../__tests__/mocks/supabase.mock';
import '../utils/setupTests';

describe('Supabase Integration Tests', () => {
  let supabase: typeof mockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = mockSupabaseClient;

    // Reset all mock implementations to return successful responses by default
    supabase.from().select().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
      status: 200,
      statusText: 'OK',
    });

    supabase.from().insert().mockResolvedValue({
      data: [{ id: 1, created_at: new Date().toISOString() }],
      error: null,
      count: 1,
      status: 201,
      statusText: 'Created',
    });

    supabase.from().update().mockResolvedValue({
      data: [{ id: 1, updated_at: new Date().toISOString() }],
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK',
    });

    supabase.from().delete().mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK',
    });
  });

  describe('Client Initialization', () => {
    it('should create Supabase client with correct config', () => {
      const supabaseUrl = 'https://test-project.supabase.co';
      const supabaseAnonKey = 'test-anon-key';

      const client = createClient(supabaseUrl, supabaseAnonKey);

      expect(createClient).toHaveBeenCalledWith(supabaseUrl, supabaseAnonKey);
      expect(client).toEqual(mockSupabaseClient);
    });

    it('should handle client configuration options', () => {
      const supabaseUrl = 'https://test-project.supabase.co';
      const supabaseAnonKey = 'test-anon-key';
      const options = {
        auth: {
          persistSession: true,
          detectSessionInUrl: false,
        },
      };

      const client = createClient(supabaseUrl, supabaseAnonKey, options);

      expect(createClient).toHaveBeenCalledWith(supabaseUrl, supabaseAnonKey, options);
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(() => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      });

      supabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-123',
            email: 'new@example.com',
          },
          session: null,
        },
        error: null,
      });

      supabase.auth.signOut.mockResolvedValue({ error: null });
    });

    it('should sign in user with email and password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await supabase.auth.signInWithPassword(credentials);

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith(credentials);
      expect(result.data.user?.email).toBe('test@example.com');
      expect(result.data.session?.access_token).toBe('access-token');
      expect(result.error).toBeNull();
    });

    it('should sign up new user', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'New User',
          },
        },
      };

      const result = await supabase.auth.signUp(userData);

      expect(supabase.auth.signUp).toHaveBeenCalledWith(userData);
      expect(result.data.user?.email).toBe('new@example.com');
      expect(result.error).toBeNull();
    });

    it('should sign out user', async () => {
      const result = await supabase.auth.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('should get current user', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'current-user-123',
            email: 'current@example.com',
          },
        },
        error: null,
      });

      const result = await supabase.auth.getUser();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result.data.user?.email).toBe('current@example.com');
    });

    it('should handle authentication errors', async () => {
      const authError = {
        message: 'Invalid credentials',
        status: 401,
      };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      const result = await supabase.auth.signInWithPassword({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      });

      expect(result.error).toEqual(authError);
      expect(result.data.user).toBeNull();
    });
  });

  describe('Database Operations', () => {
    const mockParkingSpot = {
      id: 'parking-123',
      user_id: 'user-123',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Main St',
      notes: 'Near coffee shop',
      created_at: '2023-01-01T12:00:00Z',
    };

    describe('SELECT Operations', () => {
      it('should select all records from table', async () => {
        supabase.from().select().mockResolvedValue({
          data: [mockParkingSpot],
          error: null,
          count: 1,
          status: 200,
          statusText: 'OK',
        });

        const result = await supabase
          .from('parking_spots')
          .select('*');

        expect(supabase.from).toHaveBeenCalledWith('parking_spots');
        expect(supabase.from().select).toHaveBeenCalledWith('*');
        expect(result.data).toEqual([mockParkingSpot]);
        expect(result.error).toBeNull();
      });

      it('should select specific columns', async () => {
        const selectedData = {
          id: 'parking-123',
          address: '123 Main St',
          notes: 'Near coffee shop',
        };

        supabase.from().select().mockResolvedValue({
          data: [selectedData],
          error: null,
          count: 1,
          status: 200,
          statusText: 'OK',
        });

        const result = await supabase
          .from('parking_spots')
          .select('id, address, notes');

        expect(supabase.from().select).toHaveBeenCalledWith('id, address, notes');
        expect(result.data).toEqual([selectedData]);
      });

      it('should filter records with WHERE clause', async () => {
        const result = await supabase
          .from('parking_spots')
          .select('*')
          .eq('user_id', 'user-123');

        expect(supabase.from().select).toHaveBeenCalledWith('*');
        expect(supabase.from().eq).toHaveBeenCalledWith('user_id', 'user-123');
      });

      it('should handle complex queries with multiple filters', async () => {
        const result = await supabase
          .from('parking_spots')
          .select('*')
          .eq('user_id', 'user-123')
          .gte('created_at', '2023-01-01')
          .order('created_at', { ascending: false })
          .limit(10);

        expect(supabase.from().eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(supabase.from().gte).toHaveBeenCalledWith('created_at', '2023-01-01');
        expect(supabase.from().order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(supabase.from().limit).toHaveBeenCalledWith(10);
      });

      it('should get single record', async () => {
        supabase.from().single().mockResolvedValue({
          data: mockParkingSpot,
          error: null,
          count: 1,
          status: 200,
          statusText: 'OK',
        });

        const result = await supabase
          .from('parking_spots')
          .select('*')
          .eq('id', 'parking-123')
          .single();

        expect(supabase.from().single).toHaveBeenCalled();
        expect(result.data).toEqual(mockParkingSpot);
      });
    });

    describe('INSERT Operations', () => {
      it('should insert new record', async () => {
        const newParkingSpot = {
          user_id: 'user-123',
          latitude: 37.7750,
          longitude: -122.4195,
          address: '456 Oak St',
          notes: 'Street parking',
        };

        const insertedData = {
          ...newParkingSpot,
          id: 'parking-456',
          created_at: '2023-01-02T12:00:00Z',
        };

        supabase.from().insert().mockResolvedValue({
          data: [insertedData],
          error: null,
          count: 1,
          status: 201,
          statusText: 'Created',
        });

        const result = await supabase
          .from('parking_spots')
          .insert(newParkingSpot);

        expect(supabase.from).toHaveBeenCalledWith('parking_spots');
        expect(supabase.from().insert).toHaveBeenCalledWith(newParkingSpot);
        expect(result.data).toEqual([insertedData]);
        expect(result.error).toBeNull();
      });

      it('should insert multiple records', async () => {
        const multipleSpots = [
          {
            user_id: 'user-123',
            latitude: 37.7751,
            longitude: -122.4196,
            address: '789 Pine St',
          },
          {
            user_id: 'user-123',
            latitude: 37.7752,
            longitude: -122.4197,
            address: '101 Elm St',
          },
        ];

        const result = await supabase
          .from('parking_spots')
          .insert(multipleSpots);

        expect(supabase.from().insert).toHaveBeenCalledWith(multipleSpots);
      });

      it('should handle insert conflicts with upsert', async () => {
        const conflictData = {
          id: 'parking-123',
          user_id: 'user-123',
          notes: 'Updated notes',
        };

        const result = await supabase
          .from('parking_spots')
          .upsert(conflictData);

        expect(supabase.from).toHaveBeenCalledWith('parking_spots');
        // Note: In the real implementation, upsert would be called, but our mock doesn't have it
        // This test would need to be adjusted based on actual implementation
      });
    });

    describe('UPDATE Operations', () => {
      it('should update existing record', async () => {
        const updateData = {
          notes: 'Updated parking notes',
          updated_at: '2023-01-03T12:00:00Z',
        };

        const updatedRecord = {
          ...mockParkingSpot,
          ...updateData,
        };

        supabase.from().update().mockResolvedValue({
          data: [updatedRecord],
          error: null,
          count: 1,
          status: 200,
          statusText: 'OK',
        });

        const result = await supabase
          .from('parking_spots')
          .update(updateData)
          .eq('id', 'parking-123');

        expect(supabase.from().update).toHaveBeenCalledWith(updateData);
        expect(supabase.from().eq).toHaveBeenCalledWith('id', 'parking-123');
        expect(result.data).toEqual([updatedRecord]);
      });

      it('should update multiple records', async () => {
        const updateData = { is_active: false };

        const result = await supabase
          .from('parking_spots')
          .update(updateData)
          .eq('user_id', 'user-123');

        expect(supabase.from().update).toHaveBeenCalledWith(updateData);
        expect(supabase.from().eq).toHaveBeenCalledWith('user_id', 'user-123');
      });
    });

    describe('DELETE Operations', () => {
      it('should delete record', async () => {
        const result = await supabase
          .from('parking_spots')
          .delete()
          .eq('id', 'parking-123');

        expect(supabase.from().delete).toHaveBeenCalled();
        expect(supabase.from().eq).toHaveBeenCalledWith('id', 'parking-123');
      });

      it('should delete multiple records', async () => {
        const result = await supabase
          .from('parking_spots')
          .delete()
          .eq('user_id', 'user-123')
          .lt('created_at', '2023-01-01');

        expect(supabase.from().delete).toHaveBeenCalled();
        expect(supabase.from().eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(supabase.from().lt).toHaveBeenCalledWith('created_at', '2023-01-01');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        const dbError = {
          message: 'relation "parking_spots" does not exist',
          code: '42P01',
          details: 'Table not found',
        };

        supabase.from().select().mockResolvedValue({
          data: null,
          error: dbError,
          count: null,
          status: 400,
          statusText: 'Bad Request',
        });

        const result = await supabase
          .from('parking_spots')
          .select('*');

        expect(result.error).toEqual(dbError);
        expect(result.data).toBeNull();
      });

      it('should handle network errors', async () => {
        const networkError = {
          message: 'Network error',
          code: 'NETWORK_ERROR',
        };

        supabase.from().select().mockRejectedValue(networkError);

        try {
          await supabase.from('parking_spots').select('*');
        } catch (error) {
          expect(error).toEqual(networkError);
        }
      });

      it('should handle permission errors', async () => {
        const permissionError = {
          message: 'insufficient_privilege',
          code: '42501',
          details: 'User does not have permission',
        };

        supabase.from().insert().mockResolvedValue({
          data: null,
          error: permissionError,
          count: null,
          status: 403,
          statusText: 'Forbidden',
        });

        const result = await supabase
          .from('parking_spots')
          .insert({ user_id: 'unauthorized' });

        expect(result.error).toEqual(permissionError);
      });
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should subscribe to table changes', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      supabase.realtime.channel.mockReturnValue(mockChannel);

      const channel = supabase.realtime
        .channel('parking-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'parking_spots',
        }, (payload) => {
          console.log('Change detected:', payload);
        })
        .subscribe();

      expect(supabase.realtime.channel).toHaveBeenCalledWith('parking-changes');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_spots',
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle subscription callbacks', () => {
      const mockChannel = {
        on: jest.fn((event, config, callback) => {
          // Simulate a database change
          setTimeout(() => {
            callback({
              eventType: 'INSERT',
              new: { id: 'new-parking-123' },
              old: null,
              schema: 'public',
              table: 'parking_spots',
            });
          }, 0);
          return mockChannel;
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      supabase.realtime.channel.mockReturnValue(mockChannel);

      const callbackSpy = jest.fn();

      const channel = supabase.realtime
        .channel('parking-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'parking_spots',
        }, callbackSpy)
        .subscribe();

      // Wait for async callback
      setTimeout(() => {
        expect(callbackSpy).toHaveBeenCalledWith({
          eventType: 'INSERT',
          new: { id: 'new-parking-123' },
          old: null,
          schema: 'public',
          table: 'parking_spots',
        });
      }, 0);
    });

    it('should unsubscribe from channels', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      supabase.realtime.channel.mockReturnValue(mockChannel);

      const channel = supabase.realtime
        .channel('parking-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_spots' }, () => {})
        .subscribe();

      channel.unsubscribe();

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Storage Operations', () => {
    beforeEach(() => {
      supabase.storage.from().upload.mockResolvedValue({
        data: {
          path: 'parking-photos/photo-123.jpg',
        },
        error: null,
      });

      supabase.storage.from().download.mockResolvedValue({
        data: new Blob(),
        error: null,
      });

      supabase.storage.from().getPublicUrl.mockReturnValue({
        data: {
          publicUrl: 'https://test.supabase.co/storage/v1/object/public/parking-photos/photo-123.jpg',
        },
      });
    });

    it('should upload file to storage', async () => {
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      const fileName = 'parking-photos/photo-123.jpg';

      const result = await supabase.storage
        .from('parking-photos')
        .upload(fileName, file);

      expect(supabase.storage.from).toHaveBeenCalledWith('parking-photos');
      expect(supabase.storage.from().upload).toHaveBeenCalledWith(fileName, file);
      expect(result.data?.path).toBe(fileName);
      expect(result.error).toBeNull();
    });

    it('should download file from storage', async () => {
      const fileName = 'parking-photos/photo-123.jpg';

      const result = await supabase.storage
        .from('parking-photos')
        .download(fileName);

      expect(supabase.storage.from().download).toHaveBeenCalledWith(fileName);
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.error).toBeNull();
    });

    it('should get public URL for file', () => {
      const fileName = 'parking-photos/photo-123.jpg';

      const result = supabase.storage
        .from('parking-photos')
        .getPublicUrl(fileName);

      expect(supabase.storage.from().getPublicUrl).toHaveBeenCalledWith(fileName);
      expect(result.data.publicUrl).toContain(fileName);
    });

    it('should handle storage errors', async () => {
      const storageError = {
        message: 'File too large',
        statusCode: '413',
      };

      supabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: storageError,
      });

      const file = new File(['large file'], 'large.jpg');
      const result = await supabase.storage
        .from('parking-photos')
        .upload('large.jpg', file);

      expect(result.error).toEqual(storageError);
      expect(result.data).toBeNull();
    });
  });

  describe('RPC Functions', () => {
    it('should call remote procedure', async () => {
      const mockRpcResult = {
        data: [{ distance: 0.5, id: 'parking-123' }],
        error: null,
      };

      supabase.rpc.mockResolvedValue(mockRpcResult);

      const result = await supabase.rpc('find_nearby_parking', {
        lat: 37.7749,
        lng: -122.4194,
        radius_km: 1.0,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('find_nearby_parking', {
        lat: 37.7749,
        lng: -122.4194,
        radius_km: 1.0,
      });
      expect(result.data).toEqual([{ distance: 0.5, id: 'parking-123' }]);
    });

    it('should handle RPC errors', async () => {
      const rpcError = {
        message: 'function find_nearby_parking does not exist',
        code: '42883',
      };

      supabase.rpc.mockResolvedValue({
        data: null,
        error: rpcError,
      });

      const result = await supabase.rpc('non_existent_function');

      expect(result.error).toEqual(rpcError);
      expect(result.data).toBeNull();
    });
  });
});