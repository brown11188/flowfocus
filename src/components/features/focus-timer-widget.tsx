"use client";
import { useState, useEffect } from "react";
import { useFocusTimer } from "./focus-timer-context";
import { useTaskStore } from "@/store/task-store";
import { Timer, Pause, Play, Square, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { getTodayStrInTz } from "@/lib/timezone";
import { isToday } from "@/lib/utils";
import { useAmbientSound, SOUND_OPTIONS, type AmbientSound } from "@/hooks/use-ambient-sound";

const DURATIONS = [25, 45, 60];

export function FocusTimerWidget() {
  const { state, taskLabel, remainingSecs, plannedMins, startFocus, pauseFocus, resumeFocus, stopFocus, addTime, setState } = useFocusTimer();
  const { tasks } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const [customTask, setCustomTask] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { sound, setSound: setAmbientSound, play: playAmbient, stop: stopAmbient } = useAmbientSound();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Listen for sidebar open-setup event
  useEffect(() => {
    const handler = () => setState("setup");
    window.addEventListener("focus-timer:open-setup", handler);
    return () => window.removeEventListener("focus-timer:open-setup", handler);
  }, [setState]);

  const todayStr = getTodayStrInTz(timezone);
  const todayTasks = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isToday(t.dueDate, timezone));

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const progress = plannedMins > 0 ? 1 - (remainingSecs / (plannedMins * 60)) : 0;

  if (state === "idle") {
    // Hide idle FAB on mobile — MobileFAB handles it
    if (isMobile) return null;
    return (
      <button
        onClick={() => setState("setup")}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
      >
        <Timer className="w-4 h-4 text-violet-500" />
        Focus
      </button>
    );
  }

  if (state === "setup") {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Start Focus Session</h3>
          <button onClick={() => setState("idle")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Task selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Task</label>
            {todayTasks.length > 0 ? (
              <select
                value={selectedTaskId ?? ""}
                onChange={e => { setSelectedTaskId(e.target.value || null); setCustomTask(""); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Custom task...</option>
                {todayTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title.slice(0, 40)}</option>
                ))}
              </select>
            ) : null}
            {(!selectedTaskId || todayTasks.length === 0) && (
              <input
                value={customTask}
                onChange={e => { setCustomTask(e.target.value); setSelectedTaskId(null); }}
                placeholder="What are you working on?"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400 mt-1.5"
              />
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => { setSelectedDuration(d); setShowCustomDuration(false); }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    selectedDuration === d && !showCustomDuration
                      ? "bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900 dark:border-violet-700 dark:text-violet-300"
                      : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  {d}m
                </button>
              ))}
              <button
                onClick={() => setShowCustomDuration(!showCustomDuration)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  showCustomDuration
                    ? "bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900 dark:border-violet-700 dark:text-violet-300"
                    : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                Custom
              </button>
            </div>
            {showCustomDuration && (
              <input
                type="number" min={1} max={180} value={customDuration}
                onChange={e => { setCustomDuration(e.target.value); if (Number(e.target.value) > 0) setSelectedDuration(Number(e.target.value)); }}
                placeholder="Minutes" className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            )}
          </div>

          {/* FEAT-06: Ambient Sound */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Sound</label>
            <div className="grid grid-cols-3 gap-1.5">
              {SOUND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAmbientSound(opt.value)}
                  className={cn(
                    "py-1.5 rounded-lg text-xs font-medium border transition-colors text-center",
                    sound === opt.value
                      ? "bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900 dark:border-violet-700 dark:text-violet-300"
                      : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              const label = selectedTaskId
                ? todayTasks.find(t => t.id === selectedTaskId)?.title || "Task"
                : customTask || "Focus session";
              startFocus(selectedTaskId, label, selectedDuration);
              // FEAT-06: Play ambient sound when focus starts
              if (sound !== "silence") playAmbient(sound);
            }}
            disabled={!selectedTaskId && !customTask.trim()}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
          >
            Start Focus
          </button>
        </div>
      </div>
    );
  }

  if (state === "active" || state === "paused") {
    const r = 32;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference * (1 - progress);

    return (
      <div className="fixed bottom-20 right-4 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 w-56">
        <div className="flex flex-col items-center">
          {/* Progress ring */}
          <div className="relative w-20 h-20 mb-2">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="4" />
              <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor"
                className={state === "paused" ? "text-amber-500" : "text-violet-500"}
                strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full mb-3">
            {taskLabel.slice(0, 30)}{taskLabel.length > 30 ? "..." : ""}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {state === "active" ? (
              <button onClick={pauseFocus} className="p-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800 transition-colors">
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={resumeFocus} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition-colors">
                <Play className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => { stopFocus(); stopAmbient(); }} className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition-colors">
              <Square className="w-4 h-4" />
            </button>
            <button onClick={() => addTime(5)} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors text-xs font-medium">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete state
  if (state === "complete") {
    // Stop ambient sound on completion
    stopAmbient();
    return (
      <div className="fixed bottom-20 right-4 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-green-200 dark:border-green-800 p-4 w-56">
        <div className="text-center">
          <div className="text-2xl mb-2">🌟</div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Session Complete!</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {Math.round(plannedMins)} min on &quot;{taskLabel.slice(0, 25)}&quot;
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { startFocus(null, "Break", 5); }}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 transition-colors"
            >
              5min Break
            </button>
            <button
              onClick={() => setState("idle")}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
