import { create } from "zustand";
import { Task, Project, Label, KanbanColumn, Sprint, Milestone, Risk, DecisionLog, ScopeChange, ApprovalItem, MeetingNote, StatusReport } from "@/types";

interface TaskStore {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  kanbanColumns: KanbanColumn[];
  sprints: Sprint[];
  milestones: Milestone[];
  risks: Risk[];
  decisionLogs: DecisionLog[];
  scopeChanges: ScopeChange[];
  approvalItems: ApprovalItem[];
  meetingNotes: MeetingNote[];
  statusReports: StatusReport[];
  isLoading: boolean;

  setTasks: (tasks: Task[]) => void;
  setProjects: (projects: Project[]) => void;
  setLabels: (labels: Label[]) => void;
  setKanbanColumns: (cols: KanbanColumn[]) => void;
  setSprints: (sprints: Sprint[]) => void;
  setMilestones: (milestones: Milestone[]) => void;
  setRisks: (items: Risk[]) => void;
  setDecisionLogs: (items: DecisionLog[]) => void;
  setScopeChanges: (items: ScopeChange[]) => void;
  setApprovalItems: (items: ApprovalItem[]) => void;
  setMeetingNotes: (items: MeetingNote[]) => void;
  setStatusReports: (items: StatusReport[]) => void;
  setIsLoading: (v: boolean) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;

  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  addKanbanColumn: (col: KanbanColumn) => void;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumn>) => void;
  removeKanbanColumn: (id: string) => void;

  addSprint: (sprint: Sprint) => void;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  removeSprint: (id: string) => void;

  addMilestone: (milestone: Milestone) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  removeMilestone: (id: string) => void;

  addRisk: (item: Risk) => void;
  updateRisk: (id: string, updates: Partial<Risk>) => void;
  removeRisk: (id: string) => void;

  addDecisionLog: (item: DecisionLog) => void;
  addScopeChange: (item: ScopeChange) => void;
  addApprovalItem: (item: ApprovalItem) => void;
  addMeetingNote: (item: MeetingNote) => void;
  addStatusReport: (item: StatusReport) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  projects: [],
  labels: [],
  kanbanColumns: [],
  sprints: [],
  milestones: [],
  risks: [],
  decisionLogs: [],
  scopeChanges: [],
  approvalItems: [],
  meetingNotes: [],
  statusReports: [],
  isLoading: false,

  setTasks: (tasks) => set({ tasks }),
  setProjects: (projects) => set({ projects }),
  setLabels: (labels) => set({ labels }),
  setKanbanColumns: (kanbanColumns) => set({ kanbanColumns }),
  setSprints: (sprints) => set({ sprints }),
  setMilestones: (milestones) => set({ milestones }),
  setRisks: (risks) => set({ risks }),
  setDecisionLogs: (decisionLogs) => set({ decisionLogs }),
  setScopeChanges: (scopeChanges) => set({ scopeChanges }),
  setApprovalItems: (approvalItems) => set({ approvalItems }),
  setMeetingNotes: (meetingNotes) => set({ meetingNotes }),
  setStatusReports: (statusReports) => set({ statusReports }),
  setIsLoading: (isLoading) => set({ isLoading }),

  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  removeProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

  addKanbanColumn: (col) =>
    set((state) => ({ kanbanColumns: [...state.kanbanColumns, col] })),
  updateKanbanColumn: (id, updates) =>
    set((state) => ({
      kanbanColumns: state.kanbanColumns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeKanbanColumn: (id) =>
    set((state) => ({
      kanbanColumns: state.kanbanColumns.filter((c) => c.id !== id),
    })),

  addSprint: (sprint) =>
    set((state) => ({ sprints: [...state.sprints, sprint] })),
  updateSprint: (id, updates) =>
    set((state) => ({
      sprints: state.sprints.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  removeSprint: (id) =>
    set((state) => ({ sprints: state.sprints.filter((s) => s.id !== id) })),

  addMilestone: (milestone) =>
    set((state) => ({ milestones: [...state.milestones, milestone] })),
  updateMilestone: (id, updates) =>
    set((state) => ({
      milestones: state.milestones.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  removeMilestone: (id) =>
    set((state) => ({
      milestones: state.milestones.filter((m) => m.id !== id),
    })),

  addRisk: (item) => set((state) => ({ risks: [item, ...state.risks] })),
  updateRisk: (id, updates) =>
    set((state) => ({
      risks: state.risks.map((risk) => (risk.id === id ? { ...risk, ...updates } : risk)),
    })),
  removeRisk: (id) => set((state) => ({ risks: state.risks.filter((risk) => risk.id !== id) })),

  addDecisionLog: (item) => set((state) => ({ decisionLogs: [item, ...state.decisionLogs] })),
  addScopeChange: (item) => set((state) => ({ scopeChanges: [item, ...state.scopeChanges] })),
  addApprovalItem: (item) => set((state) => ({ approvalItems: [item, ...state.approvalItems] })),
  addMeetingNote: (item) => set((state) => ({ meetingNotes: [item, ...state.meetingNotes] })),
  addStatusReport: (item) => set((state) => ({ statusReports: [item, ...state.statusReports] })),
}));
