/**
 * Base path for the application.
 * Next.js basePath handles <Link>, router.push(), redirect() automatically,
 * but fetch() calls to API routes must be prefixed manually.
 */
import {
  flushOfflineTaskQueue,
  getOfflineDataForPath,
  handleOfflineTaskRequest,
  isOnline,
  updateOfflineCacheFromResponse,
} from "@/lib/offline-tasks";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a relative API path with the application basePath.
 * Usage: apiFetch("/api/tasks") or apiFetch(`/api/tasks/${id}`)
 */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

function normalizeApiPath(path: string): string {
  const [pathname] = path.split("?");
  return pathname;
}

/**
 * Wrapper around fetch that automatically prefixes the basePath for relative URLs.
 *
 * Phase 2 PWA behavior:
 * - GET requests fall back to cached local data for key endpoints when offline
 * - Task mutations are queued locally while offline and synced when online again
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = normalizeApiPath(path);
  const method = (init?.method ?? "GET").toUpperCase();

  if (typeof window !== "undefined" && !isOnline()) {
    const offlineTaskResponse = await handleOfflineTaskRequest(normalizedPath, init);
    if (offlineTaskResponse) {
      return offlineTaskResponse;
    }

    const offlineResponse = getOfflineDataForPath(normalizedPath);
    if (offlineResponse) {
      return offlineResponse;
    }
  }

  const response = await fetch(apiUrl(path), init);

  if (response.ok && method === "GET") {
    await updateOfflineCacheFromResponse(normalizedPath, response);
  }

  if (response.ok && typeof window !== "undefined" && method !== "GET") {
    void flushOfflineTaskQueue();
  }

  return response;
}
