"use client";
import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export type FocusTimerState = "idle" | "setup" | "active" | "paused" | "complete";

interface FocusTimerCtx {
  state: FocusTimerState;
  taskId: string | null;
  taskLabel: string;
  plannedMins: number;
  remainingSecs: number;
  elapsedSecs: number;
  setState: (s: FocusTimerState) => void;
  startFocus: (taskId: string | null, taskLabel: string, mins: number) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  addTime: (mins: number) => void;
  openSetup: () => void;
}

const FocusTimerContext = createContext<FocusTimerCtx>({
  state: "idle",
  taskId: null,
  taskLabel: "",
  plannedMins: 25,
  remainingSecs: 0,
  elapsedSecs: 0,
  setState: () => {},
  startFocus: () => {},
  pauseFocus: () => {},
  resumeFocus: () => {},
  stopFocus: () => {},
  addTime: () => {},
  openSetup: () => {},
});

export function useFocusTimer() {
  return useContext(FocusTimerContext);
}

const STORAGE_KEY = "flowfocus_focus_timer";

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FocusTimerState>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskLabel, setTaskLabel] = useState("");
  const [plannedMins, setPlannedMins] = useState(25);
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef("");

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.state === "active" || data.state === "paused") {
          setTaskId(data.taskId);
          setTaskLabel(data.taskLabel);
          setPlannedMins(data.plannedMins);
          setRemainingSecs(data.remainingSecs);
          setElapsedSecs(data.elapsedSecs);
          setState(data.state);
        }
      }
    } catch { /* ignore */ }
    originalTitle.current = document.title;
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (state === "active" || state === "paused") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, taskId, taskLabel, plannedMins, remainingSecs, elapsedSecs }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state, taskId, taskLabel, plannedMins, remainingSecs, elapsedSecs]);

  // Timer tick
  useEffect(() => {
    if (state === "active") {
      intervalRef.current = setInterval(() => {
        setRemainingSecs(prev => {
          if (prev <= 1) {
            // Timer complete
            clearInterval(intervalRef.current!);
            setState("complete");
            return 0;
          }
          return prev - 1;
        });
        setElapsedSecs(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  // Update tab title
  useEffect(() => {
    if (state === "active") {
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      document.title = `⏱ ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} — FlowFocus`;
    } else if (state === "idle" || state === "complete") {
      document.title = originalTitle.current || "FlowFocus — AI-Powered Todo List";
    }
  }, [state, remainingSecs]);

  // Notification on complete
  useEffect(() => {
    if (state === "complete") {
      const actualMins = Math.round(elapsedSecs / 60);
      // Log session
      apiFetch("/api/focus-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, taskLabel, plannedMins, actualMins, wasCompleted: true }),
      }).catch(() => {});

      // FEAT-01: Auto-log time to linked task
      if (taskId && actualMins > 0) {
        apiFetch("/api/timelogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, durationMinutes: actualMins, note: `Focus session: ${actualMins}min` }),
        }).then(() => {
          toast.success(`${actualMins}m logged to "${taskLabel.slice(0, 30)}" ✓`);
        }).catch(() => {
          toast.success(`Session complete! ${actualMins} min on "${taskLabel.slice(0, 30)}"`);
        });
      } else {
        toast.success(`Session complete! ${actualMins} min on "${taskLabel.slice(0, 30)}"`);
      }

      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Focus session complete! 🌟", { body: `${actualMins} min on "${taskLabel}"` });
      }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFocus = useCallback((tid: string | null, label: string, mins: number) => {
    setTaskId(tid);
    setTaskLabel(label);
    setPlannedMins(mins);
    setRemainingSecs(mins * 60);
    setElapsedSecs(0);
    setState("active");
    // Request notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const pauseFocus = useCallback(() => setState("paused"), []);
  const resumeFocus = useCallback(() => setState("active"), []);

  const stopFocus = useCallback(() => {
    const actualMins = Math.round(elapsedSecs / 60);
    if (actualMins > 0) {
      apiFetch("/api/focus-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, taskLabel, plannedMins, actualMins, wasCompleted: false }),
      }).catch(() => {});
      // FEAT-01: Auto-log time to linked task on stop
      if (taskId) {
        apiFetch("/api/timelogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, durationMinutes: actualMins, note: `Focus session (stopped): ${actualMins}min` }),
        }).catch(() => {});
      }
      toast.info(`Logged ${actualMins} min on "${taskLabel.slice(0, 30)}"`);
    }
    setState("idle");
    setRemainingSecs(0);
    setElapsedSecs(0);
  }, [taskId, taskLabel, plannedMins, elapsedSecs]);

  const addTime = useCallback((mins: number) => {
    setRemainingSecs(prev => prev + mins * 60);
    setPlannedMins(prev => prev + mins);
  }, []);

  const openSetup = useCallback(() => setState("setup"), []);

  return (
    <FocusTimerContext.Provider
      value={{ state, taskId, taskLabel, plannedMins, remainingSecs, elapsedSecs, setState, startFocus, pauseFocus, resumeFocus, stopFocus, addTime, openSetup }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}
