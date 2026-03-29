import type { Task } from "@/types";

export function exportTasksToCSV(tasks: Task[], filename = "flowfocus-tasks.csv"): void {
  const headers = ["Title", "Project", "Priority", "Due Date", "Status", "Estimated Hours", "Labels", "Recurring"];
  const rows = tasks.map(t => [
    `"${(t.title || "").replace(/"/g, '""')}"`,
    `"${t.project?.name || "Inbox"}"`,
    `P${t.priority}`,
    t.dueDate ? t.dueDate.split("T")[0] : "",
    t.completed ? "Done" : "Active",
    t.estimatedHours ? String(t.estimatedHours) : "",
    `"${(t.labels || []).map(l => l.name || "").join(", ")}"`,
    t.recurrenceRule || "",
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  downloadFile(csv, filename, "text/csv");
}

export function exportWeeklyReviewToMarkdown(
  stats: {
    weekStart: string;
    weekEnd: string;
    completed: number;
    overdue: number;
    focusMinutes: number;
    completionRate: number;
    byProject: { name: string; count: number }[];
    overdueTasks: { title: string; dueDate: string; projectName?: string }[];
  },
  aiSummary?: string | null,
): void {
  const lines: string[] = [
    `# Weekly Review: ${stats.weekStart} — ${stats.weekEnd}`,
    "",
    "## Summary",
    `- ✅ Completed: **${stats.completed}** tasks`,
    `- ⚠️ Overdue: **${stats.overdue}** tasks`,
    `- ⏱️ Focus Time: **${Math.round(stats.focusMinutes / 60)}h ${stats.focusMinutes % 60}m**`,
    `- 📈 Completion Rate: **${stats.completionRate}%**`,
    "",
    "## By Project",
    ...stats.byProject.map(p => `- ${p.name}: ${p.count} tasks`),
    "",
  ];

  if (stats.overdueTasks.length > 0) {
    lines.push("## Overdue Tasks");
    stats.overdueTasks.forEach(t => lines.push(`- [ ] ${t.title} (due: ${t.dueDate.split("T")[0]})${t.projectName ? ` — ${t.projectName}` : ""}`));
    lines.push("");
  }

  if (aiSummary) {
    lines.push("## AI Summary", aiSummary, "");
  }

  downloadFile(lines.join("\n"), `weekly-review-${stats.weekStart}.md`, "text/markdown");
}

export function exportStatusReportToMarkdown(
  report: { title: string; content: string; summary?: string },
): void {
  const lines = [
    `# ${report.title}`,
    "",
    report.summary ? `> ${report.summary}` : "",
    "",
    report.content,
  ];
  downloadFile(lines.join("\n"), `status-report-${new Date().toISOString().split("T")[0]}.md`, "text/markdown");
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}