/**
 * useVisualBreadcrumbs Hook
 * React hook for managing visual breadcrumbs
 */

import { useState, useEffect, useCallback } from 'react';
import { visualBreadcrumbs, VisualBreadcrumb, BreadcrumbOptions } from '../services/visualBreadcrumbs';

export function useVisualBreadcrumbs(sessionId: string | null) {
  const [breadcrumbs, setBreadcrumbs] = useState<VisualBreadcrumb[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load breadcrumbs when session ID changes
  useEffect(() => {
    if (sessionId) {
      loadBreadcrumbs();
    } else {
      setBreadcrumbs([]);
    }
  }, [sessionId]);

  const loadBreadcrumbs = useCallback(() => {
    if (!sessionId) return;

    try {
      const loaded = visualBreadcrumbs.getBreadcrumbs(sessionId);
      setBreadcrumbs(loaded);
      setError(null);
    } catch (err) {
      console.error('[useVisualBreadcrumbs] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load breadcrumbs');
    }
  }, [sessionId]);

  const capturePhoto = useCallback(
    async (options?: BreadcrumbOptions): Promise<VisualBreadcrumb | null> => {
      if (!sessionId) {
        setError('No active parking session');
        return null;
      }

      try {
        setIsCapturing(true);
        setError(null);

        const breadcrumb = await visualBreadcrumbs.captureQuickPhoto(sessionId, options);

        if (breadcrumb) {
          loadBreadcrumbs(); // Refresh list
          return breadcrumb;
        }

        return null;
      } catch (err) {
        console.error('[useVisualBreadcrumbs] Capture error:', err);
        setError(err instanceof Error ? err.message : 'Failed to capture photo');
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [sessionId, loadBreadcrumbs]
  );

  const selectFromLibrary = useCallback(
    async (options?: BreadcrumbOptions): Promise<VisualBreadcrumb | null> => {
      if (!sessionId) {
        setError('No active parking session');
        return null;
      }

      try {
        setIsCapturing(true);
        setError(null);

        const breadcrumb = await visualBreadcrumbs.selectFromLibrary(sessionId, options);

        if (breadcrumb) {
          loadBreadcrumbs(); // Refresh list
          return breadcrumb;
        }

        return null;
      } catch (err) {
        console.error('[useVisualBreadcrumbs] Library error:', err);
        setError(err instanceof Error ? err.message : 'Failed to select photo');
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [sessionId, loadBreadcrumbs]
  );

  const deleteBreadcrumb = useCallback(
    async (breadcrumbId: string): Promise<boolean> => {
      if (!sessionId) {
        setError('No active parking session');
        return false;
      }

      try {
        setError(null);
        await visualBreadcrumbs.deleteBreadcrumb(sessionId, breadcrumbId);
        loadBreadcrumbs(); // Refresh list
        return true;
      } catch (err) {
        console.error('[useVisualBreadcrumbs] Delete error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete breadcrumb');
        return false;
      }
    },
    [sessionId, loadBreadcrumbs]
  );

  const clearAll = useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      setError('No active parking session');
      return false;
    }

    try {
      setError(null);
      await visualBreadcrumbs.clearSessionBreadcrumbs(sessionId);
      setBreadcrumbs([]);
      return true;
    } catch (err) {
      console.error('[useVisualBreadcrumbs] Clear error:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear breadcrumbs');
      return false;
    }
  }, [sessionId]);

  const getSummary = useCallback((): string => {
    if (!sessionId) return 'No landmarks saved';
    return visualBreadcrumbs.getSummary(sessionId);
  }, [sessionId, breadcrumbs]);

  return {
    breadcrumbs,
    isCapturing,
    error,
    count: breadcrumbs.length,
    summary: getSummary(),
    capturePhoto,
    selectFromLibrary,
    deleteBreadcrumb,
    clearAll,
    refresh: loadBreadcrumbs,
  };
}

export default useVisualBreadcrumbs;
