"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Users, ChevronRight, Loader2, AlertCircle, PartyPopper } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer?: { emailAddress: { address: string; name: string } } | null;
  attendees?: Array<{ emailAddress: { address: string; name: string } }>;
}

export function NextMeetingCard() {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [msConnected, setMsConnected] = useState(true);

  const loadNext = useCallback(async () => {
    try {
      const now = new Date();
      const threeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const res = await apiFetch(
        `/api/microsoft/calendar?startDate=${now.toISOString()}&endDate=${threeHours.toISOString()}`
      );
      if (res.status === 400) {
        setMsConnected(false);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      // Find the next upcoming event
      const upcoming = (data.events || [])
        .filter((e: CalendarEvent) => new Date(e.start.dateTime) > now)
        .sort((a: CalendarEvent, b: CalendarEvent) =>
          new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
        );

      setEvent(upcoming[0] || null);
    } catch {
      setMsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNext();
    const interval = setInterval(loadNext, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [loadNext]);

  if (!msConnected) {
    return null; // Don't show card if MS not connected
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          <span className="text-xs text-gray-400">Checking calendar...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-950/30 border-b border-green-100 dark:border-green-800/50">
          <Calendar className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400 flex-1">Next Meeting</span>
        </div>
        <div className="p-4 text-center">
          <PartyPopper className="w-6 h-6 text-green-400 mx-auto mb-1.5" />
          <p className="text-xs text-gray-500 dark:text-gray-400">No meetings in the next 3 hours 🎉</p>
        </div>
      </div>
    );
  }

  const meetingStart = new Date(event.start.dateTime);
  const minsUntil = Math.max(0, Math.round((meetingStart.getTime() - Date.now()) / 60000));
  const timeUntil = minsUntil < 60
    ? `in ${minsUntil} min`
    : `in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`;
  const isSoon = minsUntil <= 30;
  const attendeeCount = event.attendees?.length ?? 0;

  return (
    <div className={cn(
      "bg-white dark:bg-gray-900 rounded-xl border overflow-hidden",
      isSoon
        ? "border-violet-200 dark:border-violet-800/50"
        : "border-gray-100 dark:border-gray-800"
    )}>
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 border-b",
        isSoon
          ? "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-800/50"
          : "bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800"
      )}>
        <Calendar className={cn("w-4 h-4", isSoon ? "text-violet-500" : "text-gray-500")} />
        <span className={cn("text-sm font-medium flex-1", isSoon ? "text-violet-700 dark:text-violet-400" : "text-gray-700 dark:text-gray-300")}>Next Meeting</span>
        <span className={cn("text-xs font-medium", isSoon ? "text-violet-600 dark:text-violet-400" : "text-gray-500")}>{timeUntil}</span>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.subject || "(No title)"}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {meetingStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {attendeeCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {attendeeCount}
            </span>
          )}
        </div>
        <Link
          href="/pm?tab=meetings"
          className={cn(
            "mt-3 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-xs font-medium transition-colors",
            isSoon
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-950 dark:hover:text-violet-400"
          )}
        >
          Prep <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
