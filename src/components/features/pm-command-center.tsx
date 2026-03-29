"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useTaskStore } from "@/store/task-store";
import { computeProjectHealth } from "@/lib/pm";
import { AlertTriangle, ArrowRight, Clock3, FolderKanban, ShieldAlert } from "lucide-react";

export function PMCommandCenter() {
  const { tasks, projects, risks, approvalItems, scopeChanges } = useTaskStore();

  const data = useMemo(() => {
    const activeProjects = projects.filter((p) => !p.isInbox);
    const projectHealth = activeProjects.map((project) => ({
      project,
      health: computeProjectHealth({
        project,
        tasks: tasks.filter((t) => t.projectId === project.id),
        risks: risks.filter((r) => r.projectId === project.id),
        approvals: approvalItems.filter((a) => a.projectId === project.id),
        scopeChanges: scopeChanges.filter((s) => s.projectId === project.id),
      }),
    })).sort((a, b) => a.health.score - b.health.score);

    const blocked = tasks.filter((t) => !t.completed && !t.isDeleted && ((t.blockedBy?.length ?? 0) > 0 || !!t.waitingOn || !!t.blockedAt));
    const pendingApprovals = approvalItems.filter((a) => a.status === "pending");
    const openRisks = risks.filter((r) => r.status === "open" || r.status === "watching");

    return { projectHealth, blocked, pendingApprovals, openRisks };
  }, [tasks, projects, risks, approvalItems, scopeChanges]);

  const cards = [
    { label: "At-risk projects", value: data.projectHealth.filter((p) => p.health.status === "red").length, icon: FolderKanban, href: "/pm", tone: "text-red-500" },
    { label: "Blocked tasks", value: data.blocked.length, icon: AlertTriangle, href: "/pm?tab=risks", tone: "text-amber-500" },
    { label: "Pending approvals", value: data.pendingApprovals.length, icon: Clock3, href: "/pm?tab=approvals", tone: "text-blue-500" },
    { label: "Open risks", value: data.openRisks.length, icon: ShieldAlert, href: "/pm?tab=risks", tone: "text-violet-500" },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`w-4 h-4 ${card.tone}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{card.label}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
        </Link>
      ))}
      {/* Link to full PM workspace */}
      <div className="col-span-2 xl:col-span-4 flex justify-end">
        <Link href="/pm" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-500 hover:text-violet-600 transition-colors">
          Open PM workspace <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
