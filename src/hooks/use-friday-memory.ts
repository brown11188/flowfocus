"use client";
import { useState, useCallback, useEffect } from "react";

export interface FridayMemory {
  preferredFocusTimes: string[];
  commonCategories: string[];
  focusProjects: string[];
  communicationStyle: "concise" | "detailed" | "motivational";
  productivityPatterns: string[];
  customNotes: string[];
  lastUpdated: string;
}

const STORAGE_KEY = "flowfocus_friday_memory";

const DEFAULT_MEMORY: FridayMemory = {
  preferredFocusTimes: [],
  commonCategories: [],
  focusProjects: [],
  communicationStyle: "concise",
  productivityPatterns: [],
  customNotes: [],
  lastUpdated: new Date().toISOString(),
};

function loadMemory(): FridayMemory {
  if (typeof window === "undefined") return DEFAULT_MEMORY;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_MEMORY, ...JSON.parse(saved) } : DEFAULT_MEMORY;
  } catch {
    return DEFAULT_MEMORY;
  }
}

export function useFridayMemory() {
  const [memory, setMemoryState] = useState<FridayMemory>(loadMemory);

  const save = useCallback((updated: FridayMemory) => {
    const withTimestamp = { ...updated, lastUpdated: new Date().toISOString() };
    setMemoryState(withTimestamp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
  }, []);

  const addNote = useCallback((note: string) => {
    setMemoryState(prev => {
      const updated = { ...prev, customNotes: [...prev.customNotes.slice(-19), note], lastUpdated: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeNote = useCallback((index: number) => {
    setMemoryState(prev => {
      const updated = { ...prev, customNotes: prev.customNotes.filter((_, i) => i !== index), lastUpdated: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setStyle = useCallback((style: FridayMemory["communicationStyle"]) => {
    setMemoryState(prev => {
      const updated = { ...prev, communicationStyle: style, lastUpdated: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const learnPattern = useCallback((pattern: string) => {
    setMemoryState(prev => {
      if (prev.productivityPatterns.includes(pattern)) return prev;
      const updated = { ...prev, productivityPatterns: [...prev.productivityPatterns.slice(-9), pattern], lastUpdated: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearMemory = useCallback(() => {
    save(DEFAULT_MEMORY);
  }, [save]);

  const getContextForAI = useCallback((): string => {
    const parts: string[] = [];
    if (memory.communicationStyle !== "concise") {
      parts.push(`User prefers ${memory.communicationStyle} responses.`);
    }
    if (memory.productivityPatterns.length > 0) {
      parts.push(`Productivity patterns: ${memory.productivityPatterns.join("; ")}`);
    }
    if (memory.customNotes.length > 0) {
      parts.push(`User notes: ${memory.customNotes.slice(-5).join("; ")}`);
    }
    if (memory.preferredFocusTimes.length > 0) {
      parts.push(`Preferred focus times: ${memory.preferredFocusTimes.join(", ")}`);
    }
    return parts.join(" ");
  }, [memory]);

  return {
    memory,
    save,
    addNote,
    removeNote,
    setStyle,
    learnPattern,
    clearMemory,
    getContextForAI,
  };
}