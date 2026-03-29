"use client";
import { useState, useEffect } from "react";
import { QuickCaptureModal } from "./quick-capture-modal";

export function QuickCaptureWrapper() {
  const [open, setOpen] = useState(false);
  const [prefillText, setPrefillText] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPrefillText("");
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) setPrefillText(detail.text);
      else setPrefillText("");
      setOpen(true);
    };
    window.addEventListener("quick-capture:open", handler);
    return () => window.removeEventListener("quick-capture:open", handler);
  }, []);

  if (!open) return null;
  return <QuickCaptureModal onClose={() => { setOpen(false); setPrefillText(""); }} prefillText={prefillText} />;
}
