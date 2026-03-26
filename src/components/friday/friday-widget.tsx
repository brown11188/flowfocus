"use client";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { FridayPanel, FridayTriggerButton } from "./friday-panel";

export function FridayWidget() {
  const [open, setOpen] = useState(false);

  // Listen for sidebar button event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("friday:open", handler);
    return () => window.removeEventListener("friday:open", handler);
  }, []);

  return (
    <>
      <AnimatePresence>
        {open && <FridayPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
      {!open && <FridayTriggerButton onClick={() => setOpen(true)} />}
    </>
  );
}
