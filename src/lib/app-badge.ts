/**
 * App Badge — uses Badging API when available, falls back to document.title.
 */

export function isBadgingSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

export function setAppBadge(count: number): void {
  if (typeof document === "undefined") return;

  if (isBadgingSupported()) {
    navigator.setAppBadge(count).catch(() => {});
  }

  document.title = count > 0 ? `(${count}) FlowFocus` : "FlowFocus";
}

export function clearAppBadge(): void {
  if (typeof document === "undefined") return;

  if (isBadgingSupported()) {
    navigator.clearAppBadge().catch(() => {});
  }

  document.title = "FlowFocus";
}
