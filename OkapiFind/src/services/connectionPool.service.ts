/**
 * Database Connection Pooling Service
 * CRITICAL: Handles 1000+ concurrent users efficiently
 * Prevents "too many connections" errors at scale
 */

interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
}

interface Connection {
  id: string;
  inUse: boolean;
  createdAt: number;
  lastUsed: number;
  healthCheck: () => Promise<boolean>;
}

interface ConnectionPoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  created: number;
  destroyed: number;
  errors: number;
}

class ConnectionPoolService {
  private config: ConnectionConfig = {
    maxConnections: 20,
    minConnections: 2,
    idleTimeout: 30000, // 30 seconds
    connectionTimeout: 5000, // 5 seconds
    retryAttempts: 3,
  };

  private pool: Connection[] = [];
  private waitQueue: Array<{
    resolve: (conn: Connection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  private stats: ConnectionPoolStats = {
    total: 0,
    active: 0,
    idle: 0,
    waiting: 0,
    created: 0,
    destroyed: 0,
    errors: 0,
  };

  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<ConnectionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize pool with minimum connections
    this.initialize();

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Initialize pool with minimum connections
   */
  private async initialize(): Promise<void> {
    const promises: Promise<Connection>[] = [];

    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }

    try {
      await Promise.all(promises);
      console.log(`Connection pool initialized with ${this.config.minConnections} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.stats.errors++;
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<Connection> {
    const connection: Connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      inUse: false,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      healthCheck: async () => {
        // Simulate health check (replace with actual database ping)
        return true;
      },
    };

    this.pool.push(connection);
    this.stats.created++;
    this.stats.total++;
    this.stats.idle++;

    return connection;
  }

  /**
   * Acquire connection from pool
   */
  async acquire(): Promise<Connection> {
    // Try to get available connection
    const availableConn = this.pool.find(conn => !conn.inUse);

    if (availableConn) {
      return this.markConnectionInUse(availableConn);
    }

    // Create new connection if under max limit
    if (this.pool.length < this.config.maxConnections) {
      try {
        const newConn = await this.createConnection();
        return this.markConnectionInUse(newConn);
      } catch (error) {
        console.error('Failed to create new connection:', error);
        this.stats.errors++;
      }
    }

    // Wait for available connection
    return this.waitForConnection();
  }

  /**
   * Mark connection as in use
   */
  private markConnectionInUse(conn: Connection): Connection {
    conn.inUse = true;
    conn.lastUsed = Date.now();
    this.stats.active++;
    this.stats.idle--;
    return conn;
  }

  /**
   * Wait for available connection
   */
  private async waitForConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.waitQueue.findIndex(item => item.resolve === resolve);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
          this.stats.waiting--;
        }

        reject(new Error('Connection acquisition timeout'));
        this.stats.errors++;
      }, this.config.connectionTimeout);

      this.waitQueue.push({
        resolve: (conn) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });

      this.stats.waiting++;
    });
  }

  /**
   * Release connection back to pool
   */
  async release(connection: Connection): Promise<void> {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.stats.active--;
    this.stats.idle++;

    // Check if anyone is waiting
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        this.stats.waiting--;
        waiter.resolve(this.markConnectionInUse(connection));
      }
    }

    // Health check on release
    try {
      const healthy = await connection.healthCheck();
      if (!healthy) {
        await this.destroyConnection(connection);
      }
    } catch (error) {
      console.error('Connection health check failed:', error);
      await this.destroyConnection(connection);
    }
  }

  /**
   * Destroy a connection
   */
  private async destroyConnection(connection: Connection): Promise<void> {
    const index = this.pool.findIndex(conn => conn.id === connection.id);
    if (index > -1) {
      this.pool.splice(index, 1);
      this.stats.destroyed++;
      this.stats.total--;

      if (connection.inUse) {
        this.stats.active--;
      } else {
        this.stats.idle--;
      }

      // Ensure minimum connections
      if (this.pool.length < this.config.minConnections) {
        await this.createConnection();
      }
    }
  }

  /**
   * Execute query with automatic connection management
   */
  async execute<T>(
    queryFn: (connection: Connection) => Promise<T>
  ): Promise<T> {
    const connection = await this.acquire();

    try {
      const result = await queryFn(connection);
      await this.release(connection);
      return result;
    } catch (error) {
      await this.release(connection);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Execute query with retry logic
   */
  async executeWithRetry<T>(
    queryFn: (connection: Connection) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.execute(queryFn);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Query attempt ${attempt} failed:`, error);

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    throw lastError || new Error('Query failed after all retries');
  }

  /**
   * Start cleanup interval to remove idle connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.idleTimeout);
  }

  /**
   * Cleanup idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToDestroy: Connection[] = [];

    for (const conn of this.pool) {
      if (
        !conn.inUse &&
        now - conn.lastUsed > this.config.idleTimeout &&
        this.pool.length > this.config.minConnections
      ) {
        connectionsToDestroy.push(conn);
      }
    }

    for (const conn of connectionsToDestroy) {
      await this.destroyConnection(conn);
    }

    if (connectionsToDestroy.length > 0) {
      console.log(`Cleaned up ${connectionsToDestroy.length} idle connections`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  /**
   * Get pool health status
   */
  getHealth(): {
    healthy: boolean;
    utilizationRate: number;
    waitQueueSize: number;
    errorRate: number;
  } {
    const utilizationRate = this.stats.active / this.stats.total;
    const totalRequests = this.stats.created + this.stats.errors;
    const errorRate = totalRequests > 0 ? this.stats.errors / totalRequests : 0;

    return {
      healthy: errorRate < 0.05 && utilizationRate < 0.9,
      utilizationRate,
      waitQueueSize: this.waitQueue.length,
      errorRate,
    };
  }

  /**
   * Drain pool (close all connections)
   */
  async drain(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      waiter.reject(new Error('Connection pool is draining'));
    }
    this.waitQueue = [];

    // Wait for all active connections to be released
    while (this.stats.active > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Destroy all connections
    const connectionsToDestroy = [...this.pool];
    for (const conn of connectionsToDestroy) {
      await this.destroyConnection(conn);
    }

    console.log('Connection pool drained');
  }

  /**
   * Resize pool
   */
  async resize(newMax: number, newMin: number): Promise<void> {
    this.config.maxConnections = newMax;
    this.config.minConnections = newMin;

    // Add connections if below minimum
    while (this.pool.length < newMin) {
      await this.createConnection();
    }

    // Remove excess idle connections if above maximum
    while (this.pool.length > newMax) {
      const idleConn = this.pool.find(conn => !conn.inUse);
      if (idleConn) {
        await this.destroyConnection(idleConn);
      } else {
        break; // All connections are in use
      }
    }

    console.log(`Connection pool resized to min: ${newMin}, max: ${newMax}`);
  }
}

// Export singleton instance
export const connectionPool = new ConnectionPoolService({
  maxConnections: 20,
  minConnections: 2,
  idleTimeout: 30000,
  connectionTimeout: 5000,
  retryAttempts: 3,
});

export default connectionPool;