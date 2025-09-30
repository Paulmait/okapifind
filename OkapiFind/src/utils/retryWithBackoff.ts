/**
 * Smart Retry with Exponential Backoff
 * Automatically retries failed async operations with increasing delays
 */

import { logger } from '../services/logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  onRetry: () => {},
  shouldRetry: () => true,
};

/**
 * Retry an async function with exponential backoff
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => supabase.from('users').select('*'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxRetries - 1) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = opts.baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelay);

      logger.warn('Retrying operation', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: Math.round(delay),
        error: error.message,
      });

      // Call onRetry callback
      opts.onRetry(attempt + 1, error);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Retry with specific error handling
 */
export async function retryNetwork<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    ...options,
    shouldRetry: (error: Error) => {
      // Retry on network errors
      const networkErrors = [
        'network',
        'timeout',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'fetch failed',
      ];

      const errorMessage = error.message.toLowerCase();
      return networkErrors.some(keyword => errorMessage.includes(keyword));
    },
  });
}

/**
 * Retry with rate limit handling
 */
export async function retryWithRateLimit<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    ...options,
    shouldRetry: (error: Error) => {
      // Retry on rate limit errors
      const rateLimitErrors = ['429', 'too many requests', 'rate limit'];
      const errorMessage = error.message.toLowerCase();
      return rateLimitErrors.some(keyword => errorMessage.includes(keyword));
    },
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(
    () => promiseWithTimeout(fn(), timeoutMs),
    options
  );
}

/**
 * Add timeout to a promise
 */
function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}