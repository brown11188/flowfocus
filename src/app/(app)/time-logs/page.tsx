"use client";
import { useState, useEffect } from "react";
import { TimeLog } from "@/types";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Clock, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimeLogsPage() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));

  const load = async (ws: Date) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/timelogs?week=' + ws.toISOString());
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load time logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(weekStart); }, [weekStart]);

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const thisWeek = () => setWeekStart(getWeekStart(new Date()));

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);

  // Group by day
  const byDay: Record<string, TimeLog[]> = {};
  logs.forEach(l => {
    const day = new Date(l.loggedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(l);
  });

  // Group by project
  const byProject: Record<string, number> = {};
  logs.forEach(l => {
    const proj = (l as any).task?.project?.name ?? 'No Project';
    byProject[proj] = (byProject[proj] ?? 0) + l.durationMinutes;
  });

  const handleDelete = async (id: string) => {
    try {
      await apiFetch('/api/timelogs/' + id, { method: 'DELETE' });
      setLogs(prev => prev.filter(l => l.id !== id));
      toast.success('Log removed');
    } catch { toast.error('Failed to remove log'); }
  };

  const handleExport = () => {
    const newline = String.fromCharCode(10);
    const rows: string[][] = [['Date','Task','Project','Duration (min)','Note']];
    logs.forEach(l => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyLog = l as any;
      rows.push([new Date(l.loggedAt).toLocaleDateString(), anyLog.task?.title ?? l.taskId, anyLog.task?.project?.name ?? '', String(l.durationMinutes), l.note ?? '']);
    });
    const csv = rows.map(r => r.map(c => '"' + c.replace(/"/g, '""') + '"').join(',')).join(newline);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'time-logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Logs</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track time spent on tasks</p>
            </div>
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">{weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{formatDuration(totalMinutes)}</p>
            <p className="text-xs text-gray-400">total logged</p>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="flex justify-center">
          <button onClick={thisWeek} className="text-xs text-violet-600 dark:text-violet-400 hover:underline">Jump to this week</button>
        </div>

        {/* Project breakdown */}
        {Object.keys(byProject).length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">By Project</h3>
            <div className="space-y-2">
              {Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([proj, mins]) => (
                <div key={proj} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate">{proj}</span>
                  <div className="flex-1 max-w-32 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.round((mins / totalMinutes) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-800 dark:text-white w-16 text-right">{formatDuration(mins)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily logs */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No time logged this week</p>
            <p className="text-sm text-gray-400 mt-1">Log time from within a task detail panel</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byDay).map(([day, dayLogs]) => (
              <div key={day} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{day}</span>
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{formatDuration(dayLogs.reduce((s, l) => s + l.durationMinutes, 0))}</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {dayLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                      <Clock className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{(log as any).task?.title ?? 'Task'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {(log as any).task?.project?.name && <span style={{ color: (log as any).task?.project?.color }}>{(log as any).task.project.name}</span>}
                          {log.note && <span>— {log.note}</span>}
                        </div>
                      </div>
                      <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">{formatDuration(log.durationMinutes)}</span>
                      <button onClick={() => handleDelete(log.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
