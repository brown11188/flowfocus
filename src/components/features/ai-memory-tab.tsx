"use client";
import { useState } from "react";
import { Sparkles, Plus, X, Trash2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFridayMemory, type FridayMemory } from "@/hooks/use-friday-memory";
import { toast } from "sonner";

const STYLE_OPTIONS: { value: FridayMemory["communicationStyle"]; label: string; desc: string }[] = [
  { value: "concise", label: "Concise", desc: "Short, direct responses" },
  { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
  { value: "motivational", label: "Motivational", desc: "Encouraging, coaching tone" },
];

export function AIMemoryTab() {
  const { memory, addNote, removeNote, setStyle, clearMemory, learnPattern } = useFridayMemory();
  const [newNote, setNewNote] = useState("");
  const [newPattern, setNewPattern] = useState("");

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote(newNote.trim());
    setNewNote("");
    toast.success("Note added to Friday's memory");
  };

  const handleAddPattern = () => {
    if (!newPattern.trim()) return;
    learnPattern(newPattern.trim());
    setNewPattern("");
    toast.success("Pattern recorded");
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-500" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Friday AI Memory</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Friday remembers your preferences and patterns to give you better suggestions over time. You can view and edit what Friday knows about you.
      </p>

      {/* Communication Style */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Communication Style</label>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStyle(opt.value); toast.success(`Style set to ${opt.label}`); }}
              className={cn(
                "p-3 rounded-xl border text-left transition-colors",
                memory.communicationStyle === opt.value
                  ? "bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Productivity Patterns */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Productivity Patterns</label>
        <p className="text-xs text-gray-400 mb-2">Things Friday has learned about your work habits</p>
        {memory.productivityPatterns.length > 0 ? (
          <div className="space-y-1.5">
            {memory.productivityPatterns.map((pattern, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-sm text-gray-600 dark:text-gray-400">
                <Sparkles className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <span className="flex-1">{pattern}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No patterns learned yet. Use FlowFocus for a few weeks and Friday will start noticing patterns.</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <input
            value={newPattern}
            onChange={e => setNewPattern(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddPattern(); }}
            placeholder="e.g., Most productive on Tuesday mornings"
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button onClick={handleAddPattern} disabled={!newPattern.trim()} className="p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Custom Notes */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Custom Notes for Friday</label>
        <p className="text-xs text-gray-400 mb-2">Add context that helps Friday give you better advice</p>
        {memory.customNotes.length > 0 ? (
          <div className="space-y-1.5">
            {memory.customNotes.map((note, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">• {note}</span>
                <button onClick={() => removeNote(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No custom notes yet</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <input
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddNote(); }}
            placeholder="e.g., I prefer tasks in the morning, meetings in the afternoon"
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button onClick={handleAddNote} disabled={!newNote.trim()} className="p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Last updated + Clear */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400">Last updated: {new Date(memory.lastUpdated).toLocaleString()}</p>
        <button
          onClick={() => { clearMemory(); toast.success("Friday's memory cleared"); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Clear all memory
        </button>
      </div>
    </div>
  );
}