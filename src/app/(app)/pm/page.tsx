"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTaskStore } from "@/store/task-store";
import { SectionCard } from "@/components/composed/section-card";
import { HealthBadge } from "@/components/composed/health-badge";
import { PMCopilotShortcuts } from "@/components/features/pm-copilot-shortcuts";
import { computeProjectHealth } from "@/lib/pm";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, FileText, ShieldAlert, Workflow, Users, Mail, RefreshCw } from "lucide-react";
import { PMMeetingsTab } from "@/components/features/pm-meetings-tab";

interface FollowUpsResponse {
  pendingApprovals: Array<{ id: string; title: string; approver?: string | null; dueDate?: string | null }>;
  blockedTasks: Array<{ id: string; title: string; waitingOn?: string | null; project?: { name: string } | null }>;
  email: { missedReplyCount: number; needsReplyCount: number; aiSummary?: string | null } | null;
}

interface ReportDraftResponse {
  title: string;
  summary: string;
  content: string;
}

export default function PMWorkspacePage() {
  const { tasks, projects, risks, approvalItems, scopeChanges, decisionLogs, meetingNotes, statusReports, addRisk, addApprovalItem, addScopeChange, addDecisionLog, addMeetingNote, addStatusReport } = useTaskStore();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as "overview" | "risks" | "approvals" | "scope" | "reports" | "decisions" | "meetings" | null;
  const [activeTab, setActiveTab] = useState<"overview" | "risks" | "approvals" | "scope" | "reports" | "decisions" | "meetings">(initialTab || "overview");
  const [followUps, setFollowUps] = useState<FollowUpsResponse | null>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraftResponse | null>(null);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const health = useMemo(() => projects.filter((p) => !p.isInbox).map((project) => ({
    project,
    result: computeProjectHealth({
      project,
      tasks: tasks.filter((t) => t.projectId === project.id),
      risks: risks.filter((r) => r.projectId === project.id),
      approvals: approvalItems.filter((a) => a.projectId === project.id),
      scopeChanges: scopeChanges.filter((s) => s.projectId === project.id),
    }),
  })).sort((a, b) => a.result.score - b.result.score), [projects, tasks, risks, approvalItems, scopeChanges]);

  const defaultProjectId = projects.find((p) => !p.isInbox)?.id ?? projects[0]?.id;

  const loadFollowUps = async () => {
    setLoadingFollowUps(true);
    try {
      const res = await apiFetch("/api/pm/follow-ups");
      if (!res.ok) throw new Error("Failed");
      setFollowUps(await res.json());
    } catch {
      toast.error("Failed to load follow-up data");
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const generateDraft = async () => {
    setLoadingDraft(true);
    try {
      const res = await apiFetch("/api/pm/report-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: defaultProjectId ?? null }),
      });
      if (!res.ok) throw new Error("Failed");
      setReportDraft(await res.json());
      toast.success("Status draft generated");
    } catch {
      toast.error("Failed to generate report draft");
    } finally {
      setLoadingDraft(false);
    }
  };

  useEffect(() => {
    void loadFollowUps();
  }, []);

  const createQuickItem = async (type: "risk" | "approval" | "scope" | "decision" | "meeting" | "report") => {
    if (!defaultProjectId && type !== "report" && type !== "meeting") {
      toast.error("Create a project first");
      return;
    }
    try {
      if (type === "risk") {
        const res = await apiFetch("/api/risks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New delivery risk", projectId: defaultProjectId, probability: 3, impact: 4, mitigationPlan: "Define mitigation next standup" }) });
        addRisk(await res.json());
      }
      if (type === "approval") {
        const res = await apiFetch("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Stakeholder approval needed", projectId: defaultProjectId, status: "pending" }) });
        addApprovalItem(await res.json());
      }
      if (type === "scope") {
        const res = await apiFetch("/api/scope-changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New scope request", projectId: defaultProjectId, impactLevel: "medium", approvalStatus: "pending" }) });
        addScopeChange(await res.json());
      }
      if (type === "decision") {
        const res = await apiFetch("/api/decision-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Decision pending", projectId: defaultProjectId, decision: "TBD", context: "Record the decision context here" }) });
        addDecisionLog(await res.json());
      }
      if (type === "meeting") {
        const res = await apiFetch("/api/meeting-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Meeting notes", projectId: defaultProjectId ?? null, rawNotes: "Summary, decisions, and action items..." }) });
        addMeetingNote(await res.json());
      }
      if (type === "report") {
        const res = await apiFetch("/api/status-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Weekly status update", projectId: defaultProjectId ?? null, reportType: "weekly", content: "Completed:\n-\nNext:\n-\nRisks:\n-", generatedBy: "manual" }) });
        addStatusReport(await res.json());
      }
      toast.success("Item created");
    } catch {
      toast.error("Failed to create item");
    }
  };

  const tabs = [
    ["overview", "Overview"],
    ["risks", "Risks"],
    ["approvals", "Approvals"],
    ["scope", "Scope"],
    ["reports", "Reports"],
    ["decisions", "Decisions"],
    ["meetings", "Meetings"],
  ] as const;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PM Workspace</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Command center for project health, follow-up, risks, approvals, scope, and reporting.</p>
      </div>

      <SectionCard title="PM Copilot" description="Quick AI prompts for daily project management">
        <PMCopilotShortcuts />
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${activeTab === id ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800"}`}>{label}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SectionCard title="Project health score" description="Low scores surface execution risk first">
            <div className="space-y-3">
              {health.map(({ project, result }) => (
                <div key={project.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{project.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{result.reasons.slice(0, 2).join(" · ")}</p>
                  </div>
                  <HealthBadge status={result.status} score={result.score} compact />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Quick create" description="Seed PM records quickly during the day">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => createQuickItem("risk")} className="rounded-xl border p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"><ShieldAlert className="w-4 h-4 text-red-500 mb-2" /><div className="text-sm font-medium">New risk</div></button>
              <button onClick={() => createQuickItem("approval")} className="rounded-xl border p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"><ClipboardCheck className="w-4 h-4 text-blue-500 mb-2" /><div className="text-sm font-medium">New approval</div></button>
              <button onClick={() => createQuickItem("scope")} className="rounded-xl border p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"><Workflow className="w-4 h-4 text-amber-500 mb-2" /><div className="text-sm font-medium">Scope change</div></button>
              <button onClick={() => createQuickItem("report")} className="rounded-xl border p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"><FileText className="w-4 h-4 text-violet-500 mb-2" /><div className="text-sm font-medium">Status report</div></button>
            </div>
          </SectionCard>

          <SectionCard
            title="Follow-up assistant"
            description="Approvals, blockers, and stakeholder reply pressure"
            action={<button onClick={() => void loadFollowUps()} className="text-xs text-violet-500 inline-flex items-center gap-1"><RefreshCw className={`w-3 h-3 ${loadingFollowUps ? "animate-spin" : ""}`} /> Refresh</button>}
          >
            {followUps ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border p-3"><div className="text-xs text-gray-500">Pending approvals</div><div className="text-xl font-semibold text-blue-500">{followUps.pendingApprovals.length}</div></div>
                  <div className="rounded-xl border p-3"><div className="text-xs text-gray-500">Blocked tasks</div><div className="text-xl font-semibold text-amber-500">{followUps.blockedTasks.length}</div></div>
                  <div className="rounded-xl border p-3"><div className="text-xs text-gray-500">Email pressure</div><div className="text-xl font-semibold text-red-500">{(followUps.email?.missedReplyCount ?? 0) + (followUps.email?.needsReplyCount ?? 0)}</div></div>
                </div>
                <div className="space-y-2">
                  {followUps.blockedTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2.5">
                      <div className="font-medium text-gray-900 dark:text-white">{task.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Waiting on: {task.waitingOn ?? "Dependency"}{task.project?.name ? ` · ${task.project.name}` : ""}</div>
                    </div>
                  ))}
                  {followUps.email?.aiSummary && (
                    <div className="rounded-lg border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-3 text-xs text-violet-700 dark:text-violet-300 flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{followUps.email.aiSummary}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No follow-up snapshot yet.</p>
            )}
          </SectionCard>

          <SectionCard
            title="AI status report draft"
            description="Generate a ready-to-edit stakeholder update"
            action={<button onClick={() => void generateDraft()} className="text-xs text-violet-500 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {loadingDraft ? "Generating..." : "Generate"}</button>}
          >
            {reportDraft ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{reportDraft.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{reportDraft.summary}</p>
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-6 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3 text-gray-700 dark:text-gray-300">{reportDraft.content}</pre>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Generate a first draft from tasks, approvals, and risks.</p>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === "risks" && <ListSection title="Risk register" items={risks.map((r) => ({ id: r.id, title: r.title, subtitle: `${r.status} · score ${r.score}${r.owner ? ` · ${r.owner}` : ""}` }))} icon={<AlertTriangle className="w-4 h-4 text-red-500" />} empty="No risks yet" emptyDesc="Track project risks, their probability and impact, and mitigation plans." emptyAction="+ Log your first risk" onAdd={() => createQuickItem("risk")} />}
      {activeTab === "approvals" && <ListSection title="Approval workflow" items={approvalItems.map((a) => ({ id: a.id, title: a.title, subtitle: `${a.status}${a.approver ? ` · ${a.approver}` : ""}` }))} icon={<ClipboardCheck className="w-4 h-4 text-blue-500" />} empty="No approvals yet" emptyDesc="Track pending approvals from stakeholders and team members." emptyAction="+ Create approval request" onAdd={() => createQuickItem("approval")} />}
      {activeTab === "scope" && <ListSection title="Scope change log" items={scopeChanges.map((s) => ({ id: s.id, title: s.title, subtitle: `${s.approvalStatus} · ${s.impactLevel}${s.requestedBy ? ` · ${s.requestedBy}` : ""}` }))} icon={<Workflow className="w-4 h-4 text-amber-500" />} empty="No scope changes yet" emptyDesc="Document and track changes to project scope, timeline, and effort." emptyAction="+ Record a scope change" onAdd={() => createQuickItem("scope")} />}
      {activeTab === "reports" && <ListSection title="Status reports" items={statusReports.map((r) => ({ id: r.id, title: r.title, subtitle: `${r.reportType} · ${r.audience}` }))} icon={<FileText className="w-4 h-4 text-violet-500" />} empty="No reports yet" emptyDesc="Generate and share stakeholder status reports powered by AI." emptyAction="Generate AI status report" onAdd={() => void generateDraft()} />}
      {activeTab === "decisions" && <ListSection title="Decision log" items={decisionLogs.map((d) => ({ id: d.id, title: d.title, subtitle: d.decision }))} icon={<ClipboardCheck className="w-4 h-4 text-emerald-500" />} empty="No decisions yet" emptyDesc="Keep a record of all important decisions made during the project." emptyAction="+ Record a decision" onAdd={() => createQuickItem("decision")} />}
      {activeTab === "meetings" && <PMMeetingsTab />}
    </div>
  );
}

function ListSection({ title, items, empty, emptyDesc, emptyAction, onAdd, icon }: { title: string; items: { id: string; title: string; subtitle: string }[]; empty: string; emptyDesc?: string; emptyAction?: string; onAdd?: () => void; icon: React.ReactNode }) {
  return (
    <SectionCard title={title} description={`${items.length} item(s)`}>
      {items.length === 0 ? (
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">{icon}</div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{empty}</p>
          {emptyDesc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">{emptyDesc}</p>}
          {emptyAction && onAdd && (
            <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">{emptyAction}</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-start gap-3">
              <div className="mt-0.5">{icon}</div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
