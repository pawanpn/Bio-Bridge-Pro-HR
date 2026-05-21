// ============================================================
// Bio-Bridge Pro HR — Universal Async Hook
// Replaces all ad-hoc loading/error state patterns.
// Every page uses this — never manage loading state manually.
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import { ApiError } from "../services/api";

// ─── Types ───────────────────────────────────────────────────

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

export interface UseAsyncReturn<T> extends AsyncState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
  setData: (data: T) => void;
}

const initialState = <T>(): AsyncState<T> => ({
  data: null,
  status: "idle",
  error: null,
  isLoading: false,
  isSuccess: false,
  isError: false,
  isIdle: true,
});

// ─── useAsync ────────────────────────────────────────────────

/**
 * Generic async state manager.
 *
 * @example
 * const { data, isLoading, error, execute } = useAsync(api.employees.list);
 *
 * useEffect(() => { execute({ page: 1 }); }, []);
 */
export function useAsync<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    immediate?: boolean;
    immediateArgs?: unknown[];
  }
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>(initialState<T>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      if (!mountedRef.current) return null;

      setState({
        data: null,
        status: "loading",
        error: null,
        isLoading: true,
        isSuccess: false,
        isError: false,
        isIdle: false,
      });

      try {
        const result = await asyncFn(...args);
        if (!mountedRef.current) return null;
        setState({
          data: result,
          status: "success",
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
          isIdle: false,
        });
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;
        const errorMsg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "An unexpected error occurred";
        setState({
          data: null,
          status: "error",
          error: errorMsg,
          isLoading: false,
          isSuccess: false,
          isError: true,
          isIdle: false,
        });
        options?.onError?.(errorMsg);
        return null;
      }
    },
    [asyncFn, options]
  );

  // Run immediately on mount if requested
  useEffect(() => {
    if (options?.immediate) {
      execute(...(options.immediateArgs ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setState(initialState<T>());
  }, []);

  const setData = useCallback((data: T) => {
    setState(prev => ({
      ...prev,
      data,
      status: "success",
      isSuccess: true,
      isError: false,
      isIdle: false,
    }));
  }, []);

  return { ...state, execute, reset, setData };
}

// ─── useAsyncList ─────────────────────────────────────────────

/**
 * Specialized hook for list data with inline optimistic updates.
 *
 * @example
 * const { items, isLoading, reload, addItem, removeItem } =
 *   useAsyncList(() => api.employees.list());
 */
export function useAsyncList<T extends { id: string }>(
  fetchFn: () => Promise<{ data: T[] } | T[]>
) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (!mountedRef.current) return;
      const list = Array.isArray(result) ? result : result.data;
      setItems(list);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchFn]);

  /** Optimistically add an item */
  const addItem = useCallback((item: T) => {
    setItems(prev => [item, ...prev]);
  }, []);

  /** Optimistically update an item */
  const updateItem = useCallback((id: string, updated: Partial<T>) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updated } : item))
    );
  }, []);

  /** Optimistically remove an item */
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { items, isLoading, error, reload, addItem, updateItem, removeItem };
}

// ─── useSubmit ────────────────────────────────────────────────

/**
 * For form submission actions (create/update/delete).
 * Does NOT auto-execute on mount.
 *
 * @example
 * const { submit, isSubmitting, error, isSuccess } =
 *   useSubmit(api.employees.create, {
 *     onSuccess: (emp) => { toast.success('Employee created'); navigate('/employees'); }
 *   });
 *
 * <button onClick={() => submit(formData)} disabled={isSubmitting}>Save</button>
 */
export function useSubmit<TArgs, TResult>(
  submitFn: (args: TArgs) => Promise<TResult>,
  options?: {
    onSuccess?: (result: TResult) => void;
    onError?: (error: string) => void;
    successMessage?: string;
    errorMessage?: string;
  }
) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setSuccess] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const submit = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      setSubmitting(true);
      setError(null);
      setSuccess(false);
      try {
        const result = await submitFn(args);
        if (!mountedRef.current) return null;
        setSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;
        const errorMsg =
          options?.errorMessage ??
          (err instanceof Error ? err.message : "Operation failed");
        setError(errorMsg);
        options?.onError?.(errorMsg);
        return null;
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [submitFn, options]
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }, []);

  return { submit, isSubmitting, error, isSuccess, reset };
}
