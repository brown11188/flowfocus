"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function getSharedText(searchParams: URLSearchParams): string {
  const directShare = searchParams.get("share")?.trim() ?? "";
  if (directShare) {
    return directShare;
  }

  const values = [searchParams.get("title"), searchParams.get("text"), searchParams.get("url")]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  return Array.from(new Set(values)).join("\n");
}

export function PWAShareTargetListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const rawQuery = searchParams.toString();
    if (!rawQuery) {
      handledRef.current = null;
      return;
    }

    const signature = `${pathname}?${rawQuery}`;
    if (handledRef.current === signature) {
      return;
    }

    const quickCapture = searchParams.get("quickCapture") === "1";
    const openFriday = searchParams.get("friday") === "1";
    const sharedText = getSharedText(new URLSearchParams(rawQuery));

    if (!quickCapture && !openFriday && !sharedText) {
      return;
    }

    handledRef.current = signature;

    window.requestAnimationFrame(() => {
      if (openFriday) {
        window.dispatchEvent(new CustomEvent("friday:open"));
      } else {
        window.dispatchEvent(
          new CustomEvent("quick-capture:open", {
            detail: sharedText ? { text: sharedText } : undefined,
          }),
        );
      }
    });

    if (sharedText) {
      toast.success("Shared into FlowFocus.");
    }

    const nextParams = new URLSearchParams(rawQuery);
    ["quickCapture", "friday", "share", "title", "text", "url"].forEach((key) => nextParams.delete(key));
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
