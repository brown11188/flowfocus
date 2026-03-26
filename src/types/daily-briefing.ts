// ─── Daily Briefing types ────────────────────────────────────────────────────

export interface DailyBriefingCalendarEvent {
  id: string;
  subject: string;
  startTime: string;   // "09:00"
  endTime: string;     // "10:00"
  location?: string;
  webLink?: string;
  isNow: boolean;
}

export interface DailyBriefingTask {
  taskId: string;
  title: string;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  projectName: string;
  rank: number;
  reason: string;
  estimatedHours?: number;
}

export interface DailyBriefingOverdueItem {
  taskId: string;
  title: string;
  daysOverdue: number;
}

export interface DailyBriefingEmailItem {
  id: string;
  subject: string;
  fromName: string;
  urgency: "high" | "medium";
  category: "missed" | "needs_reply";
  webLink?: string;
}

export interface DailyBriefingDayPlanSlot {
  timeSlot: string;   // "09:00 - 10:00"
  type: "meeting" | "task" | "break" | "buffer";
  title: string;
  taskId?: string;
  eventId?: string;
}

export interface DailyBriefing {
  generatedAt: string;         // ISO timestamp
  greeting: string;

  calendarSection?: {
    events: DailyBriefingCalendarEvent[];
    summary: string;
  };

  priorityTasks: DailyBriefingTask[];

  overdueAlert?: {
    count: number;
    topItems: DailyBriefingOverdueItem[];
    message: string;
  };

  emailActions?: {
    urgentCount: number;
    items: DailyBriefingEmailItem[];
    summary: string;
  };

  sprintStatus?: {
    sprintName: string;
    goal?: string;
    daysLeft: number;
    progressPct: number;
    doneTasks: number;
    totalTasks: number;
    isOnTrack: boolean;
    message: string;
  };

  dayPlan?: DailyBriefingDayPlanSlot[];

  coachingMessage: string;

  metadata: {
    hasCalendar: boolean;
    hasEmailDigest: boolean;
    hasActiveSprint: boolean;
    overdueCount: number;
    todayTaskCount: number;
    isFromCache: boolean;
  };
}
