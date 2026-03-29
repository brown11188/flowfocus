import { getHealthColor, clamp } from "@/lib/utils";
import type { Project, Task, Risk, ScopeChange, ApprovalItem } from "@/types";

export interface ProjectHealthResult {
  score: number;
  status: "green" | "yellow" | "red";
  reasons: string[];
}

export function computeProjectHealth(params: {
  project: Project;
  tasks: Task[];
  risks?: Risk[];
  scopeChanges?: ScopeChange[];
  approvals?: ApprovalItem[];
}): ProjectHealthResult {
  const { tasks, risks = [], scopeChanges = [], approvals = [] } = params;

  if (tasks.length === 0) {
    return { score: 92, status: "green", reasons: ["Project has no active tasks yet"] };
  }

  const active = tasks.filter((t) => !t.completed && !t.isDeleted);
  const overdue = active.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
  const blocked = active.filter((t) => (t.blockedBy?.length ?? 0) > 0 || !!t.waitingOn || !!t.blockedAt);
  const noDueDate = active.filter((t) => !t.dueDate);
  const noAssignee = active.filter((t) => !t.assigneeName && !(t.clickupAssignees && t.clickupAssignees !== "[]"));
  const openRisks = risks.filter((r) => r.status === "open" || r.status === "watching");
  const pendingScope = scopeChanges.filter((s) => s.approvalStatus === "pending");
  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  let score = 100;
  score -= Math.round((overdue.length / Math.max(active.length, 1)) * 35);
  score -= Math.round((blocked.length / Math.max(active.length, 1)) * 20);
  score -= Math.min(openRisks.length * 6, 18);
  score -= Math.min(pendingScope.length * 4, 12);
  score -= Math.min(pendingApprovals.length * 3, 9);
  score -= Math.round((noDueDate.length / Math.max(active.length, 1)) * 10);
  score -= Math.round((noAssignee.length / Math.max(active.length, 1)) * 8);
  score = clamp(score, 0, 100);

  const reasons: string[] = [];
  if (overdue.length > 0) reasons.push(`${overdue.length} overdue task${overdue.length !== 1 ? "s" : ""}`);
  if (blocked.length > 0) reasons.push(`${blocked.length} blocked item${blocked.length !== 1 ? "s" : ""}`);
  if (openRisks.length > 0) reasons.push(`${openRisks.length} active risk${openRisks.length !== 1 ? "s" : ""}`);
  if (pendingApprovals.length > 0) reasons.push(`${pendingApprovals.length} pending approval${pendingApprovals.length !== 1 ? "s" : ""}`);
  if (pendingScope.length > 0) reasons.push(`${pendingScope.length} pending scope change${pendingScope.length !== 1 ? "s" : ""}`);
  if (noAssignee.length > 0) reasons.push(`${noAssignee.length} unassigned task${noAssignee.length !== 1 ? "s" : ""}`);
  if (reasons.length === 0) reasons.push("Execution is on track");

  return { score, status: getHealthColor(score), reasons };
}
