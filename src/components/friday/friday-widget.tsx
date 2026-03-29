"use client";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { FridayPanel, FridayTriggerButton } from "./friday-panel";

export function FridayWidget() {
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    const promptHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ prompt?: string }>;
      setInitialPrompt(customEvent.detail?.prompt ?? null);
      setOpen(true);
    };
    window.addEventListener("friday:open", handler);
    window.addEventListener("ai-assistant:open", handler);
    window.addEventListener("friday:open-with-prompt", promptHandler as EventListener);
    return () => {
      window.removeEventListener("friday:open", handler);
      window.removeEventListener("ai-assistant:open", handler);
      window.removeEventListener("friday:open-with-prompt", promptHandler as EventListener);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {open && <FridayPanel onClose={() => setOpen(false)} initialPrompt={initialPrompt} onConsumedInitialPrompt={() => setInitialPrompt(null)} />}
      </AnimatePresence>
      {/* Hide trigger button on mobile — MobileFAB handles it */}
      {!open && !isMobile && <FridayTriggerButton onClick={() => setOpen(true)} />}
    </>
  );
}
