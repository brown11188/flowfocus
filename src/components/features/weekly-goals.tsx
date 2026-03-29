"use client";
import { useState, useEffect } from "react";
import { Target, Check, Plus, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "flowfocus_weekly_goals";

interface WeeklyGoal {
  id: string;
  text: string;
  completed: boolean;
}

function getWeekKey() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1); // Monday
  return start.toISOString().split("T")[0];
}

export function WeeklyGoals() {
  const weekKey = getWeekKey();
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${weekKey}`);
      if (saved) setGoals(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [weekKey]);

  const save = (updated: WeeklyGoal[]) => {
    setGoals(updated);
    localStorage.setItem(`${STORAGE_KEY}_${weekKey}`, JSON.stringify(updated));
  };

  const addGoal = () => {
    if (!newGoal.trim() || goals.length >= 5) return;
    save([...goals, { id: crypto.randomUUID(), text: newGoal.trim(), completed: false }]);
    setNewGoal("");
    setAdding(false);
  };

  const toggleGoal = (id: string) => {
    save(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const removeGoal = (id: string) => {
    save(goals.filter(g => g.id !== id));
  };

  const completedCount = goals.filter(g => g.completed).length;
  const achievementPct = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
        <Target className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex-1">🎯 Weekly Goals</span>
        {goals.length > 0 && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{achievementPct}%</span>
        )}
      </div>
      <div className="p-4">
        {goals.length === 0 && !adding ? (
          <div className="text-center py-4">
            <Target className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Set your top goals for this week</p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Set Goals
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
                    goal.completed
                      ? "bg-green-500 border-green-500"
                      : "border-gray-300 dark:border-gray-600 hover:border-amber-500"
                  )}
                >
                  {goal.completed && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className={cn(
                  "text-sm flex-1",
                  goal.completed ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"
                )}>{goal.text}</span>
                <button onClick={() => removeGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {adding ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addGoal(); if (e.key === "Escape") setAdding(false); }}
                  placeholder="What do you want to achieve?"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
                <button onClick={addGoal} className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : goals.length < 5 && (
              <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 transition-colors mt-1">
                <Plus className="w-3 h-3" /> Add goal
              </button>
            )}

            {goals.length > 0 && (
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${achievementPct}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}