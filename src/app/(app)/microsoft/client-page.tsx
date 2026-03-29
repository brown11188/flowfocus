"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";

import { toast } from "sonner";
import Link from "next/link";
import {
  Calendar, Mail, RefreshCw, Unlink, CheckCircle2,
  ExternalLink, Loader2, Sparkles, ArrowLeft,
  Clock, MapPin, Users, ChevronLeft, ChevronRight,
  MailOpen, AlertCircle, Inbox, Star, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MicrosoftConnection {
  id: string;
  email: string | null;
  displayName: string | null;
  syncEmailsEnabled: boolean;
  syncCalendarEnabled: boolean;
  lastEmailSyncAt: string | null;
  lastCalendarSyncAt: string | null;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  subject: string | null;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string } | null;
  webLink: string | null;
  isAllDay: boolean;
  bodyPreview: string | null;
  organizer: { emailAddress: { address: string; name: string } } | null;
  isRecurring?: boolean;
}

interface EmailItem {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  receivedDateTime: string;
  isRead: boolean;
  isMeetingInvite: boolean;
  from: { name: string | null; email: string | null } | null;
  webLink: string | null;
}

type ActiveTab = "calendar" | "email";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function msLogo(size = 20) {
  const s = size / 2;
  return (
    <svg viewBox="0 0 23 23" style={{ width: size, height: size }}>
      <path fill="#f35325" d={`M0 0h${s}v${s}H0z`} />
      <path fill="#81bc06" d={`M${s + 1} 0h${s}v${s}H${s + 1}z`} />
      <path fill="#05a6f0" d={`M0 ${s + 1}h${s}v${s}H0z`} />
      <path fill="#ffba08" d={`M${s + 1} ${s + 1}h${s}v${s}H${s + 1}z`} />
    </svg>
  );
}

function formatTime(dt: string, tz: string) {
  return new Date(dt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
}

function formatDateShort(dt: string, tz: string) {
  return new Date(dt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
}

function formatDateFull(dt: string, tz: string) {
  return new Date(dt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz });
}

function getDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(dt: string, tz: string): string {
  return new Date(dt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

function isToday(dt: string, tz: string): boolean {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const dtStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(dt));
  return dtStr === todayStr;
}

function isTomorrow(dt: string, tz: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(tomorrow);
  const dtStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(dt));
  return dtStr === tomorrowStr;
}

/**
 * Group events by their local date in the user's timezone.
 * Uses en-CA format (YYYY-MM-DD) as the grouping key so date comparisons
 * are consistent regardless of the browser's local timezone.
 */
function groupEventsByDate(events: CalendarEvent[], tz: string): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(ev.start.dateTime));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

/**
 * Get a human-readable label for a YYYY-MM-DD date string in the user's timezone.
 */
function getDateLabel(dateStr: string, tz: string): string {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(tomorrow);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterday);

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  if (dateStr === yesterdayStr) return "Yesterday";

  // Parse the YYYY-MM-DD and format in the user's timezone
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid date-shift edge cases
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz });
}

function formatLastSync(isoString: string, tz: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

const EVENT_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
];

// ─── Not Connected View ───────────────────────────────────────────────────────

function NotConnectedView({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-8">
      <div className="w-20 h-20 rounded-3xl bg-[#0078D4]/10 dark:bg-[#0078D4]/20 flex items-center justify-center mb-6">
        {msLogo(40)}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Microsoft Account</h2>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8">
        Link your Microsoft / Outlook account to view your calendar events, read emails,
        and convert them into FlowFocus tasks — all in one place.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
        {[
          { icon: Calendar, color: "violet", title: "Calendar", desc: "See upcoming Outlook events side-by-side with your tasks" },
          { icon: Mail, color: "blue", title: "Email → Task", desc: "Convert emails into tasks with AI summaries" },
          { icon: Sparkles, color: "amber", title: "AI Reports", desc: "Smart summaries of your schedule and inbox" },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-2xl border text-center",
            color === "violet" && "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900",
            color === "blue" && "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900",
            color === "amber" && "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900",
          )}>
            <Icon className={cn("w-5 h-5",
              color === "violet" && "text-violet-500",
              color === "blue" && "text-blue-500",
              color === "amber" && "text-amber-500",
            )} />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onConnect}
        className="flex items-center gap-3 px-8 py-3.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded-2xl font-semibold text-base transition-colors shadow-lg shadow-[#0078D4]/20"
      >
        {msLogo(22)}
        Sign in with Microsoft
      </button>
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({
  events, loading, onRefresh, connection,
}: {
  events: CalendarEvent[];
  loading: boolean;
  onRefresh: () => void;
  connection: MicrosoftConnection;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewWeek, setViewWeek] = useState(0); // 0 = current week
  const { timezone } = useTimezoneCtx();

  const grouped = groupEventsByDate(events, timezone);
  const sortedDates = Array.from(grouped.keys()).sort();

  const todayEvents = events.filter(e => isToday(e.start.dateTime, timezone));
  const upcomingEvents = events.filter(e => !isToday(e.start.dateTime, timezone));

  // Format last sync time with timezone
  const lastSyncFormatted = connection.lastCalendarSyncAt
    ? formatLastSync(connection.lastCalendarSyncAt, timezone)
    : null;

  return (
    <div className="flex h-full gap-0 relative">
      {/* Event list */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Outlook Calendar</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {events.length} events · next 14 days
                {lastSyncFormatted && (
                  <span className="ml-2 text-gray-400">
                    · synced {lastSyncFormatted}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#0078D4] hover:bg-[#0078D4]/10 rounded-xl transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#0078D4] animate-spin" />
            <p className="text-sm text-gray-500">Loading your calendar…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-700" />
            <p className="text-sm font-medium text-gray-500">No events in the next 14 days</p>
            <p className="text-xs text-gray-400">Your Outlook Calendar is clear ahead!</p>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-4 space-y-6">
            {/* Today summary card */}
            {todayEvents.length > 0 && (
              <div className="p-4 bg-[#0078D4]/5 dark:bg-[#0078D4]/10 border border-[#0078D4]/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#0078D4] animate-pulse" />
                  <span className="text-sm font-semibold text-[#0078D4]">Today — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone })}</span>
                  <span className="ml-auto text-xs text-[#0078D4]/70 font-medium">{todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {todayEvents.map((ev, i) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-900 rounded-xl hover:shadow-sm transition-all text-left group"
                    >
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", EVENT_COLORS[i % EVENT_COLORS.length])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.subject || "(No title)"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ev.isAllDay ? "All day" : `${formatTime(ev.start.dateTime, timezone)} – ${formatTime(ev.end.dateTime, timezone)}`}
                          {ev.location?.displayName && <span className="ml-2">· {ev.location.displayName}</span>}
                        </p>
                      </div>
                      {ev.webLink && (
                        <a href={ev.webLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </a>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All events by date */}
            {sortedDates.map((dateStr, di) => {
              const dayEvents = grouped.get(dateStr)!;
              const label = getDateLabel(dateStr, timezone);
              const isToday_ = label === "Today";
              if (isToday_) return null; // already shown above
              return (
                <div key={dateStr}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-full",
                      label === "Tomorrow"
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    )}>{label}</span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    <span className="text-xs text-gray-400">{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map((ev, i) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left group",
                          selectedEvent?.id === ev.id
                            ? "border-[#0078D4]/30 bg-[#0078D4]/5 dark:bg-[#0078D4]/10"
                            : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
                        )}
                      >
                        <div className={cn("w-1 self-stretch rounded-full flex-shrink-0 mt-1", EVENT_COLORS[(di + i) % EVENT_COLORS.length])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.subject || "(No title)"}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {ev.isAllDay ? "All day" : `${formatTime(ev.start.dateTime, timezone)} – ${formatTime(ev.end.dateTime, timezone)}`}
                            </span>
                            {!ev.isAllDay && (
                              <span className="text-xs text-gray-400">
                                {getDuration(ev.start.dateTime, ev.end.dateTime)}
                              </span>
                            )}
                            {ev.location?.displayName && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[140px]">{ev.location.displayName}</span>
                              </span>
                            )}
                          </div>
                          {ev.bodyPreview && (
                            <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">{ev.bodyPreview}</p>
                          )}
                        </div>
                        {ev.webLink && (
                          <a href={ev.webLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all">
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div className="fixed inset-0 z-40 flex sm:relative sm:inset-auto sm:z-auto">
          <div className="absolute inset-0 bg-black/30 sm:hidden" onClick={() => setSelectedEvent(null)} />
          <div className="relative w-full max-w-sm ml-auto sm:w-80 sm:max-w-none h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Event Details</span>
            <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-1">
                {selectedEvent.subject || "(No title)"}
              </h3>
              {selectedEvent.isAllDay ? (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">All day</span>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDateFull(selectedEvent.start.dateTime, timezone)}
                </p>
              )}
            </div>

            {!selectedEvent.isAllDay && (
              <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <Clock className="w-4 h-4 text-[#0078D4] flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatTime(selectedEvent.start.dateTime, timezone)} – {formatTime(selectedEvent.end.dateTime, timezone)}
                  </p>
                  <p className="text-xs text-gray-500">{getDuration(selectedEvent.start.dateTime, selectedEvent.end.dateTime)} duration</p>
                </div>
              </div>
            )}

            {selectedEvent.location?.displayName && (
              <div className="flex items-start gap-2.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <MapPin className="w-4 h-4 text-[#0078D4] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedEvent.location.displayName}</p>
              </div>
            )}

            {selectedEvent.organizer?.emailAddress && (
              <div className="flex items-start gap-2.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <Users className="w-4 h-4 text-[#0078D4] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Organizer</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedEvent.organizer.emailAddress.name}</p>
                  <p className="text-xs text-gray-400">{selectedEvent.organizer.emailAddress.address}</p>
                </div>
              </div>
            )}

            {selectedEvent.bodyPreview && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Description</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{selectedEvent.bodyPreview}</p>
              </div>
            )}

            {selectedEvent.webLink && (
              <a
                href={selectedEvent.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Outlook
              </a>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Email Tab ────────────────────────────────────────────────────────────────

function EmailTab({
  emails, loading, onRefresh, onConvert, convertingId,
}: {
  emails: EmailItem[];
  loading: boolean;
  onRefresh: () => void;
  onConvert: (email: EmailItem) => void;
  convertingId: string | null;
}) {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const { timezone } = useTimezoneCtx();

  const unread = emails.filter(e => !e.isRead).length;
  const meetings = emails.filter(e => e.isMeetingInvite).length;

  return (
    <div className="flex h-full gap-0 relative">
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Outlook Inbox</h2>
              <div className="flex items-center gap-3 mt-0.5">
                {emails.length > 0 && (
                  <>
                    <span className="text-xs text-gray-500">{emails.length} emails</span>
                    {unread > 0 && <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{unread} unread</span>}
                    {meetings > 0 && <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{meetings} meeting invite{meetings !== 1 ? "s" : ""}</span>}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#0078D4] hover:bg-[#0078D4]/10 rounded-xl transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#0078D4] animate-spin" />
            <p className="text-sm text-gray-500">Loading your inbox…</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-700" />
            <p className="text-sm font-medium text-gray-500">No emails fetched</p>
            <button onClick={onRefresh} className="text-sm text-[#0078D4] hover:underline">Load inbox</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {emails.map(email => (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={cn(
                  "w-full flex items-start gap-3 px-6 py-3.5 text-left transition-colors",
                  selectedEmail?.id === email.id
                    ? "bg-[#0078D4]/5 dark:bg-[#0078D4]/10"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40",
                  !email.isRead && "bg-blue-50/40 dark:bg-blue-950/20"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {email.isRead
                    ? <MailOpen className="w-4 h-4 text-gray-400" />
                    : <Mail className="w-4 h-4 text-[#0078D4]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "text-sm truncate flex-1",
                      !email.isRead ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-300"
                    )}>
                      {email.from?.name ?? email.from?.email ?? "Unknown"}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(email.receivedDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone })}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs truncate mb-0.5",
                    !email.isRead ? "text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {email.subject || "(No subject)"}
                  </p>
                  <div className="flex items-center gap-2">
                    {email.isMeetingInvite && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded">Meeting</span>
                    )}
                    {email.bodyPreview && (
                      <p className="text-xs text-gray-400 truncate flex-1">{email.bodyPreview}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Email detail panel */}
      {selectedEmail && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm sm:relative sm:inset-auto sm:z-auto sm:w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-y-auto flex-shrink-0 shadow-xl sm:shadow-none">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Email</span>
            <button onClick={() => setSelectedEmail(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-2">
                {selectedEmail.subject || "(No subject)"}
              </h3>
              {selectedEmail.isMeetingInvite && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-full mb-2">Meeting invite</span>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-[#0078D4]/20 flex items-center justify-center text-sm font-bold text-[#0078D4] flex-shrink-0">
                {(selectedEmail.from?.name ?? selectedEmail.from?.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedEmail.from?.name || "Unknown"}</p>
                <p className="text-xs text-gray-500 truncate">{selectedEmail.from?.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedEmail.receivedDateTime).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                    timeZone: timezone,
                  })}
                </p>
              </div>
            </div>

            {selectedEmail.bodyPreview && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{selectedEmail.bodyPreview}</p>
              </div>
            )}

            <button
              onClick={() => onConvert(selectedEmail)}
              disabled={convertingId === selectedEmail.id}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {convertingId === selectedEmail.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Convert to Task with AI
            </button>

            {selectedEmail.webLink && (
              <a
                href={selectedEmail.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Outlook
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MicrosoftHubClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<MicrosoftConnection | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Email state
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // ─── Fetch connection status ───────────────────────────────────────────────

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/status`);
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection ?? null);
        return data.connection as MicrosoftConnection | null;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
    return null;
  }, []);

  // ─── Auto-load calendar on connect ────────────────────────────────────────

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`${BASE_PATH}/api/microsoft/calendar?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.events ?? []);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to load calendar");
      }
    } catch { toast.error("Failed to load calendar"); }
    finally { setCalendarLoading(false); }
  }, []);

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails ?? []);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to load emails");
      }
    } catch { toast.error("Failed to load emails"); }
    finally { setEmailsLoading(false); }
  }, []);

  // On mount: detect OAuth redirect
  useEffect(() => {
    const connected = searchParams.get("microsoft_connected");
    const fetchAndLoad = async () => {
      const conn = await fetchStatus();
      if (connected === "true" && conn) {
        toast.success(`✅ Microsoft connected as ${conn.displayName ?? conn.email ?? "Microsoft User"}`, { duration: 4000 });
        // Remove param from URL
        const url = new URL(window.location.href);
        url.searchParams.delete("microsoft_connected");
        window.history.replaceState({}, "", url.toString());
        // Auto-load calendar
        await loadCalendar();
      } else if (conn) {
        // Already connected — auto-load calendar
        await loadCalendar();
      }
    };
    fetchAndLoad();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching tabs, auto-load if empty
  useEffect(() => {
    if (activeTab === "email" && emails.length === 0 && connection) {
      loadEmails();
    }
  }, [activeTab, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleConnect = () => {
    // Redirect to our dedicated connect endpoint which:
    // 1. Generates PKCE + state cookies
    // 2. Redirects to Microsoft OAuth
    // 3. On callback, saves MicrosoftConnection for the CURRENT session user
    // 4. Redirects back here with ?microsoft_connected=true
    // This does NOT create a new NextAuth session — the user stays logged in as-is.
    window.location.href = `${BASE_PATH}/api/microsoft/connect`;
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/status`, { method: "DELETE" });
      if (res.ok) {
        setConnection(null);
        setCalendarEvents([]);
        setEmails([]);
        toast.success("Microsoft account disconnected");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch { toast.error("Failed to disconnect"); }
  };

  const handleConvertEmail = async (email: EmailItem) => {
    setConvertingId(email.id);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/convert-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ microsoftId: email.id }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`✅ Created task: "${data.task.title}"`);
        window.dispatchEvent(new CustomEvent("friday:task-created"));
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to convert email");
      }
    } catch { toast.error("Failed to convert email"); }
    finally { setConvertingId(null); }
  };

  // ─── Render: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0078D4]/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#0078D4] animate-spin" />
          </div>
          <p className="text-sm text-gray-500">Checking connection…</p>
        </div>
      </div>
    );
  }

  // ─── Render: not connected ─────────────────────────────────────────────────

  if (!connection) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-950">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            {msLogo(22)}
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Microsoft Hub</h1>
          </div>
        </div>
        <NotConnectedView onConnect={handleConnect} />
      </div>
    );
  }

  // ─── Render: connected ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0078D4] flex items-center justify-center">
              {msLogo(20)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Microsoft Hub</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Connected
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {connection.displayName ?? connection.email ?? "Microsoft User"}
                {connection.email && connection.displayName && <span className="ml-1">· {connection.email}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
          >
            <Unlink className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {([
            { id: "calendar", label: "Calendar", icon: Calendar, count: calendarEvents.length },
            { id: "email", label: "Inbox", icon: Mail, count: emails.filter(e => !e.isRead).length },
          ] as const).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-[#0078D4] text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                  activeTab === id
                    ? "bg-white/25 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "calendar" && (
          <CalendarTab
            events={calendarEvents}
            loading={calendarLoading}
            onRefresh={loadCalendar}
            connection={connection}
          />
        )}
        {activeTab === "email" && (
          <EmailTab
            emails={emails}
            loading={emailsLoading}
            onRefresh={loadEmails}
            onConvert={handleConvertEmail}
            convertingId={convertingId}
          />
        )}
      </div>
    </div>
  );
}
