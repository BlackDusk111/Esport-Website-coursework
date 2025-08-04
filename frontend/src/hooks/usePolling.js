import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for polling data at regular intervals
 * @param {Function} fetchFunction - Function to fetch data
 * @param {number} interval - Polling interval in milliseconds (default: 30000ms = 30s)
 * @param {Object} options - Additional options
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {boolean} options.fetchOnMount - Whether to fetch immediately on mount (default: true)
 * @param {Function} options.onError - Error callback function
 * @param {Function} options.onSuccess - Success callback function
 * @param {Array} options.dependencies - Dependencies that trigger refetch when changed
 */
export const usePolling = (
  fetchFunction,
  interval = 30000,
  options = {}
) => {
  const {
    enabled = true,
    fetchOnMount = true,
    onError,
    onSuccess,
    dependencies = [],
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(fetchOnMount);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      setError(null);
      const result = await fetchFunction();
      
      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        onError?.(err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction, enabled, onError, onSuccess]);

  const startPolling = useCallback(() => {
    if (!enabled || intervalRef.current) return;

    intervalRef.current = setInterval(fetchData, interval);
  }, [fetchData, interval, enabled]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Initial fetch and start polling
  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }

    if (enabled) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [fetchOnMount, enabled, startPolling, stopPolling, fetchData]);

  // Handle dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      refetch();
    }
  }, dependencies);

  // Handle enabled state change
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enabled, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
    startPolling,
    stopPolling,
  };
};

/**
 * Hook for polling with automatic pause/resume based on document visibility
 */
export const useVisibilityPolling = (fetchFunction, interval = 30000, options = {}) => {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return usePolling(fetchFunction, interval, {
    ...options,
    enabled: options.enabled !== false && isVisible,
  });
};

/**
 * Hook for polling with exponential backoff on errors
 */
export const usePollingWithBackoff = (
  fetchFunction,
  baseInterval = 30000,
  options = {}
) => {
  const [currentInterval, setCurrentInterval] = useState(baseInterval);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  const maxInterval = options.maxInterval || 300000; // 5 minutes max
  const backoffMultiplier = options.backoffMultiplier || 2;
  const maxRetries = options.maxRetries || 5;

  const handleSuccess = useCallback((data) => {
    setConsecutiveErrors(0);
    setCurrentInterval(baseInterval);
    options.onSuccess?.(data);
  }, [baseInterval, options]);

  const handleError = useCallback((error) => {
    setConsecutiveErrors(prev => {
      const newCount = prev + 1;
      
      if (newCount <= maxRetries) {
        const newInterval = Math.min(
          baseInterval * Math.pow(backoffMultiplier, newCount - 1),
          maxInterval
        );
        setCurrentInterval(newInterval);
      }
      
      return newCount;
    });
    
    options.onError?.(error);
  }, [baseInterval, backoffMultiplier, maxInterval, maxRetries, options]);

  const pollingResult = usePolling(fetchFunction, currentInterval, {
    ...options,
    onSuccess: handleSuccess,
    onError: handleError,
    enabled: options.enabled !== false && consecutiveErrors < maxRetries,
  });

  return {
    ...pollingResult,
    consecutiveErrors,
    currentInterval,
    isRetrying: consecutiveErrors > 0 && consecutiveErrors < maxRetries,
    hasMaxedRetries: consecutiveErrors >= maxRetries,
  };
};

export default usePolling;