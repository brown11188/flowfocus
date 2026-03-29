"use client";
import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { AIAssistantDrawer } from "./ai-assistant-drawer";

export function AIAssistantWrapper() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("ai-assistant:open", handler);
    return () => window.removeEventListener("ai-assistant:open", handler);
  }, []);

  return (
    <>
      {/* Floating AI button — sits above Focus Timer widget area */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[140px] right-4 z-30 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center transition-all"
          title="AI Assistant"
        >
          <Bot className="w-4.5 h-4.5" />
        </button>
      )}
      {open && <AIAssistantDrawer onClose={() => setOpen(false)} />}
    </>
  );
}
