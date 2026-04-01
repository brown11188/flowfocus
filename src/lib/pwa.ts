export const APP_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  if (!path.startsWith("/")) {
    return `${APP_BASE}/${path}`;
  }

  return `${APP_BASE}${path}`;
}

export const APP_ROOT = APP_BASE ? `${APP_BASE}/` : "/";
