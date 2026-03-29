"use client";
import { Sparkles } from "lucide-react";

const PROMPTS = [
  "What should I escalate today?",
  "Which projects are at risk this week?",
  "What am I waiting on from clients?",
  "Summarize blockers across all active projects",
  "Draft my weekly stakeholder update",
  "Show tasks with no owner or due date",
];

export function PMCopilotShortcuts() {
  const sendPrompt = (prompt: string) => {
    window.dispatchEvent(new CustomEvent("friday:open-with-prompt", { detail: { prompt } }));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          onClick={() => sendPrompt(prompt)}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          {prompt}
        </button>
      ))}
    </div>
  );
}
