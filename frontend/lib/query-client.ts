import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 seconds before data is considered stale
      staleTime: 30_000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once with exponential backoff
      retry: 1,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
      // Don't refetch just because the user re-focuses the window
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Don't retry mutations — side effects may have already occurred
      retry: false,
    },
  },
});
