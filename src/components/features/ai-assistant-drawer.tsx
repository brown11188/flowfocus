"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Copy, BookmarkPlus, CheckSquare, Sparkles, Loader2, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CONTEXT_CHIPS = [
  "What should I focus on right now?",
  "What's blocking progress this week?",
  "Summarize my email backlog",
  "What's at risk of slipping?",
  "Draft weekly stakeholder update",
  "What haven't I followed up on?",
  "Prep me for my next meeting",
];

export function AIAssistantDrawer({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await apiFetch("/api/ai/contextual-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history }),
      });

      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                fullContent += data.content;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
                scrollToBottom();
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: "Sorry, I couldn't process that. Try again." } : m)
      );
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  const handleSaveAsNote = async (text: string) => {
    try {
      await apiFetch("/api/captured-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: "note" }),
      });
      toast.success("Saved as note!");
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleCreateTask = (text: string) => {
    // Dispatch event to open QuickCapture pre-filled
    window.dispatchEvent(new CustomEvent("quick-capture:open", { detail: { text: text.slice(0, 200) } }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> AI Assistant
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            📊 Ask anything about your work
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Context chips */}
      {messages.length === 0 && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                className="px-2.5 py-1 text-xs rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-violet-300 dark:text-violet-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Ask me about your tasks, schedule, or anything work-related.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-violet-600 text-white rounded-br-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-700"
            )}>
              <p className="whitespace-pre-wrap">{msg.content || (
                <span className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </span>
              )}</p>
              {msg.role === "assistant" && msg.content && (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={() => handleCopy(msg.content)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors" title="Copy">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleSaveAsNote(msg.content)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors" title="Save as note">
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleCreateTask(msg.content)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors" title="Create task from this">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask anything about your work..."
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
