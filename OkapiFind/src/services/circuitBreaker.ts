// @ts-nocheck
/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance and prevents cascading failures
 */

import { errorService, ErrorSeverity, ErrorCategory } from './errorService';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
  fallbackFunction?: () => Promise<any>;
}

interface CircuitStats {
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  totalRequests: number;
  errorRate: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttempt: number = Date.now();
  private requestCount: number = 0;
  private readonly options: CircuitBreakerOptions;
  private readonly name: string;
  private monitoringWindow: number[] = [];

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 3000,
      resetTimeout: options.resetTimeout || 30000,
      monitoringPeriod: options.monitoringPeriod || 60000,
      fallbackFunction: options.fallbackFunction,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should attempt reset
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN;
        errorService.logInfo(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        // Circuit is OPEN, use fallback or throw error
        if (this.options.fallbackFunction) {
          return this.options.fallbackFunction();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      // Add timeout protection
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Circuit breaker timeout')), this.options.timeout)
      ),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;
    this.successes++;
    this.requestCount++;
    this.updateMonitoringWindow(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.reset();
        errorService.logInfo(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: any): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();
    this.requestCount++;
    this.updateMonitoringWindow(false);

    errorService.logWarning(`Circuit breaker ${this.name} recorded failure`, {
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      error: error?.message,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      errorService.logWarning(`Circuit breaker ${this.name} is now OPEN`);
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      errorService.logError(
        new Error(`Circuit breaker ${this.name} opened due to failures`),
        ErrorSeverity.HIGH,
        ErrorCategory.GENERAL,
        { failures: this.failures, threshold: this.options.failureThreshold }
      );
    }
  }

  /**
   * Update monitoring window for error rate calculation
   */
  private updateMonitoringWindow(success: boolean): void {
    const now = Date.now();
    const windowStart = now - this.options.monitoringPeriod;

    // Remove old entries
    this.monitoringWindow = this.monitoringWindow.filter(time => time > windowStart);

    // Add new entry (negative for failures)
    this.monitoringWindow.push(success ? now : -now);
  }

  /**
   * Calculate current error rate
   */
  getErrorRate(): number {
    if (this.monitoringWindow.length === 0) return 0;

    const failures = this.monitoringWindow.filter(time => time < 0).length;
    return failures / this.monitoringWindow.length;
  }

  /**
   * Reset circuit breaker
   */
  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
  }

  /**
   * Force reset circuit breaker
   */
  forceReset(): void {
    this.state = CircuitState.CLOSED;
    this.reset();
    errorService.logInfo(`Circuit breaker ${this.name} was forcefully reset`);
  }

  /**
   * Force open circuit breaker
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    errorService.logWarning(`Circuit breaker ${this.name} was forcefully opened`);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitStats {
    return {
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.requestCount,
      errorRate: this.getErrorRate(),
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable(): boolean {
    return this.state !== CircuitState.OPEN || Date.now() >= this.nextAttempt;
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuits
 */
class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuits: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Get or create circuit breaker
   */
  getCircuit(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(name, options));
    }
    return this.circuits.get(name)!;
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Record<string, CircuitStats & { state: CircuitState }> {
    const stats: Record<string, CircuitStats & { state: CircuitState }> = {};

    this.circuits.forEach((circuit, name) => {
      stats[name] = {
        ...circuit.getStats(),
        state: circuit.getState(),
      };
    });

    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.forEach(circuit => circuit.forceReset());
  }

  /**
   * Get unhealthy circuits
   */
  getUnhealthyCircuits(): string[] {
    const unhealthy: string[] = [];

    this.circuits.forEach((circuit, name) => {
      if (circuit.getState() !== CircuitState.CLOSED) {
        unhealthy.push(name);
      }
    });

    return unhealthy;
  }
}

export const circuitBreakerManager = CircuitBreakerManager.getInstance();