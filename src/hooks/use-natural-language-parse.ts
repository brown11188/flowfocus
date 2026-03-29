"use client";
import { useMemo } from "react";

export interface ParsedTask {
  title: string;
  dueDate: string | null;
  priority: number | null;
  recurrence: string | null;
}

// Priority keywords
const P1_WORDS = ["urgent", "critical", "asap", "high priority", "p1", "!!"];
const P2_WORDS = ["important", "medium priority", "p2"];
const P3_WORDS = ["low priority", "p3", "whenever"];

// Date patterns
const DATE_PATTERNS: Array<{ pattern: RegExp; resolver: (match: RegExpMatchArray) => Date | null }> = [
  {
    pattern: /\b(today)\b/i,
    resolver: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; },
  },
  {
    pattern: /\b(tomorrow)\b/i,
    resolver: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; },
  },
  {
    pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    resolver: (match) => {
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const target = days.indexOf(match[1].toLowerCase());
      const d = new Date();
      const current = d.getDay();
      let daysUntil = target - current;
      if (daysUntil <= 0) daysUntil += 7;
      d.setDate(d.getDate() + daysUntil);
      d.setHours(12, 0, 0, 0);
      return d;
    },
  },
  {
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    resolver: (match) => {
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const target = days.indexOf(match[1].toLowerCase());
      const d = new Date();
      const current = d.getDay();
      let daysUntil = target - current;
      if (daysUntil <= 0) daysUntil += 7;
      d.setDate(d.getDate() + daysUntil);
      d.setHours(12, 0, 0, 0);
      return d;
    },
  },
  {
    pattern: /\bin\s+(\d+)\s+days?\b/i,
    resolver: (match) => { const d = new Date(); d.setDate(d.getDate() + parseInt(match[1])); d.setHours(12, 0, 0, 0); return d; },
  },
  {
    pattern: /\bnext\s+week\b/i,
    resolver: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(12, 0, 0, 0); return d; },
  },
  {
    pattern: /\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    resolver: (match) => {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const ampm = match[3]?.toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
];

// Recurrence patterns
const RECURRENCE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bevery\s+day\b/i, value: "DAILY" },
  { pattern: /\bdaily\b/i, value: "DAILY" },
  { pattern: /\bevery\s+week\b/i, value: "WEEKLY" },
  { pattern: /\bweekly\b/i, value: "WEEKLY" },
  { pattern: /\bevery\s+month\b/i, value: "MONTHLY" },
  { pattern: /\bmonthly\b/i, value: "MONTHLY" },
  { pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: "WEEKLY" },
];

export function parseNaturalLanguage(input: string): ParsedTask {
  let text = input.trim();
  let dueDate: string | null = null;
  let priority: number | null = null;
  let recurrence: string | null = null;

  // Extract priority
  for (const word of P1_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(text)) {
      priority = 1;
      text = text.replace(regex, "").trim();
      break;
    }
  }
  if (!priority) {
    for (const word of P2_WORDS) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(text)) {
        priority = 2;
        text = text.replace(regex, "").trim();
        break;
      }
    }
  }
  if (!priority) {
    for (const word of P3_WORDS) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(text)) {
        priority = 3;
        text = text.replace(regex, "").trim();
        break;
      }
    }
  }

  // Extract recurrence
  for (const { pattern, value } of RECURRENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      recurrence = value;
      text = text.replace(match[0], "").trim();
      break;
    }
  }

  // Extract date
  for (const { pattern, resolver } of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const date = resolver(match);
      if (date) {
        dueDate = date.toISOString();
        text = text.replace(match[0], "").trim();
      }
      break;
    }
  }

  // Cleanup title
  text = text.replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");

  return { title: text, dueDate, priority, recurrence };
}

export function useNaturalLanguageParse(input: string): ParsedTask {
  return useMemo(() => parseNaturalLanguage(input), [input]);
}