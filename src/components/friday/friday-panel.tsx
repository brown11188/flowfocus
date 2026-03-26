"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, X, Minimize2, Maximize2,
  RotateCcw, CheckCircle2, Calendar, Zap,
  Loader2, ChevronRight, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ChatMessage } from "@/app/api/friday/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FridayTask {
  id: string;
  title: string;
  priority: number;
  dueDate: string | null;
  completed: boolean;
  projectName?: string;
}

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  tasks?: FridayTask[];
  createdTask?: { id: string; title: string };
  isLoading?: boolean;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: "📋", label: "What's due today?", prompt: "What tasks are due today?" },
  { icon: "🔴", label: "Show overdue", prompt: "Show me all overdue tasks" },
  { icon: "📊", label: "Weekly summary", prompt: "Give me a summary of my week" },
  { icon: "⏰", label: "2 hours free", prompt: "I have 2 hours free, what should I work on?" },
  { icon: "🎯", label: "Top priorities", prompt: "What are my top priority tasks right now?" },
  { icon: "📅", label: "This week plan", prompt: "What's coming up this week?" },
];

// ─── Priority colors ─────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  2: "text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
  3: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  4: "text-gray-400 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
};

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
    .replace(/\n/g, "<br/>");
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onRefresh }: { msg: AssistantMessage; onRefresh?: () => void }) {
  const isUser = msg.role === "user";

  // Show typing indicator only when loading AND no content yet
  if (msg.isLoading && !msg.content) {
    return (
      <div className="flex items-start gap-2">
        <FridayAvatar />
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">Friday is thinking…</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}
    >
      {!isUser && <FridayAvatar />}
      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-violet-600 text-white rounded-tr-sm"
              : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="[&_li]:marker:text-violet-400">
              <div
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              {/* Show blinking cursor when streaming */}
              {msg.isLoading && msg.content && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-violet-500 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Created task badge */}
        {msg.createdTask && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-300">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Created: <strong>{msg.createdTask.title}</strong></span>
          </div>
        )}

        {/* Task list */}
        {msg.tasks && msg.tasks.length > 0 && (
          <div className="space-y-1.5">
            {msg.tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs",
                  PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]
                )}
              >
                <span className="font-bold opacity-60">P{task.priority}</span>
                <span className="flex-1 font-medium truncate">{task.title}</span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 opacity-60 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                {task.projectName && (
                  <span className="opacity-50 flex-shrink-0 max-w-[80px] truncate">{task.projectName}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Friday Avatar ────────────────────────────────────────────────────────────

function FridayAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm",
        size === "sm" ? "w-7 h-7" : "w-10 h-10"
      )}
    >
      <Sparkles className={cn("text-white", size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5")} />
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function FridayPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Greeting on open
  useEffect(() => {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    setMessages([
      {
        role: "assistant",
        content: `${greeting}! 👋 I'm **Friday**, your AI productivity assistant.\n\nI can help you manage tasks, check deadlines, create tasks from natural language, and give you smart suggestions. What can I do for you today?`,
      },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const userMsg: AssistantMessage = { role: "user", content };
      // Start with empty assistant message that will be streamed into
      const streamingMsg: AssistantMessage = { role: "assistant", content: "", isLoading: true };

      setMessages((prev) => [...prev, userMsg, streamingMsg]);
      setInput("");
      setLoading(true);

      const newHistory: ChatMessage[] = [
        ...history,
        { role: "user", content },
      ];

      try {
        const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const res = await fetch(`${BASE_PATH}/api/friday`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newHistory }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? "Request failed");
        }

        // Handle streaming response
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let tasks: FridayTask[] | undefined;
        let createdTask: { id: string; title: string } | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "text") {
                  accumulatedContent += data.content;
                  // Update the streaming message in place
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.content = accumulatedContent;
                      lastMsg.isLoading = false;
                    }
                    return updated;
                  });
                } else if (data.type === "tasks") {
                  tasks = data.tasks;
                } else if (data.type === "createdTask") {
                  createdTask = data.createdTask;
                } else if (data.type === "done") {
                  // Finalize the message
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.isLoading = false;
                      if (tasks) lastMsg.tasks = tasks;
                      if (createdTask) lastMsg.createdTask = createdTask;
                    }
                    return updated;
                  });
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }

        setHistory([...newHistory, { role: "assistant", content: accumulatedContent }]);

        if (createdTask) {
          toast.success(`✅ Task created: "${createdTask.title}"`);
          // Dispatch event so DataProvider refreshes tasks
          window.dispatchEvent(new CustomEvent("friday:task-created"));
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: "Sorry, I ran into an error. Please try again! 🔧",
          },
        ]);
        toast.error(err instanceof Error ? err.message : "Friday encountered an error");
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [history, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setHistory([]);
    setTimeout(() => {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      setMessages([
        {
          role: "assistant",
          content: `${greeting}! Conversation cleared. How can I help you? 😊`,
        },
      ]);
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden",
        minimized ? "w-72 h-14" : "w-96 h-[600px] max-h-[90vh]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 flex-shrink-0">
        <FridayAvatar size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-none">Friday</p>
          <p className="text-violet-200 text-xs mt-0.5">AI Productivity Assistant</p>
        </div>
        <div className="flex items-center gap-1">
          {!minimized && (
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Clear conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts (only show when no user messages yet) */}
          {history.length === 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((s) => (
                  <button
                    key={s.prompt}
                    onClick={() => sendMessage(s.prompt)}
                    disabled={loading}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-gray-600 dark:text-gray-400 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50"
                  >
                    <span>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 flex-shrink-0">
            <div className="flex items-end gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 focus-within:border-violet-400 dark:focus-within:border-violet-600 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Friday anything… (Enter to send)"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none disabled:opacity-50 max-h-24 overflow-y-auto"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              Powered by DeepInfra · Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Trigger Button ───────────────────────────────────────────────────────────

export function FridayTriggerButton({ onClick, hasUnread }: { onClick: () => void; hasUnread?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow group"
      title="Open Friday AI Assistant"
    >
      <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      {hasUnread && (
        <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
      )}
    </motion.button>
  );
}
