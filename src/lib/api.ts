/**
 * Base path for the application.
 * Next.js basePath handles <Link>, router.push(), redirect() automatically,
 * but fetch() calls to API routes must be prefixed manually.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a relative API path with the application basePath.
 * Usage: apiFetch("/api/tasks") or apiFetch(`/api/tasks/${id}`)
 */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * Wrapper around fetch that automatically prefixes the basePath for relative URLs.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
