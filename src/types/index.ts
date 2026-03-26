export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority: 1 | 2 | 3 | 4;
  completed: boolean;
  completedAt?: string | null;
  isDeleted?: boolean;
  sortOrder: number;
  userId: string;
  projectId?: string | null;
  parentId?: string | null;
  depth?: number;

  // Pillar 1: Recurring
  recurrenceRule?: string | null;     // DAILY | WEEKLY | MONTHLY | CUSTOM
  recurrenceInterval?: number | null;
  recurrenceDays?: string | null;     // JSON "[1,3,5]"
  recurrenceEndDate?: string | null;
  recurringParentId?: string | null;

  // Pillar 2: Time tracking
  estimatedHours?: number | null;

  // Pillar 3: Kanban / Sprint
  status?: string;          // TODO | IN_PROGRESS | REVIEW | DONE
  kanbanColumnId?: string | null;
  sprintId?: string | null;

  createdAt: string;
  updatedAt: string;
  project?: Project | null;
  labels?: Label[];
  subtasks?: Task[];

  // Pillar 1: Dependencies
  blockedBy?: TaskDependency[];
  blocking?: TaskDependency[];

  // Pillar 2: Time logs
  timeLogs?: TimeLog[];

  // Milestones
  milestones?: MilestoneTask[];

  // ClickUp integration
  clickupTaskId?: string | null;
  clickupListId?: string | null;
  clickupSpaceId?: string | null;
  clickupUrl?: string | null;
  clickupStatus?: string | null;
  clickupAssignees?: string | null; // JSON string ["user1","user2"]
  importedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  isInbox: boolean;
  sortOrder: number;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { tasks: number };

  // ClickUp integration
  clickupSpaceId?: string | null;
  clickupSpaceName?: string | null;
  clickupTeamId?: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt?: string;
}

export interface AIPriority {
  taskId: string;
  rank: number;
  reason: string;
}

export interface AIFocusResult {
  summary: string;
  priorities: AIPriority[];
  greeting: string;
}

export interface Stats {
  completedToday: number;
  totalToday: number;
  streak: number;
  weeklyData: { day: string; count: number }[];
}

// Pillar 1: Task Dependency
export interface TaskDependency {
  id: string;
  blockedTaskId: string;
  blockingTaskId: string;
  blockingTask?: Task;
  blockedTask?: Task;
}

// Pillar 1: Milestone
export interface Milestone {
  id: string;
  name: string;
  description?: string | null;
  targetDate: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  tasks?: MilestoneTask[];
  _count?: { tasks: number };
}

export interface MilestoneTask {
  milestoneId: string;
  taskId: string;
  milestone?: Milestone;
  task?: Task;
}

// Pillar 2: TimeLog
export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  note?: string | null;
  loggedAt: string;
}

// Pillar 3: KanbanColumn
export interface KanbanColumn {
  id: string;
  name: string;
  projectId: string;
  sortOrder: number;
  isDefault: boolean;
  color: string;
  tasks?: Task[];
}

// Pillar 3: Sprint
export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCompleted: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  _count?: { tasks: number };
}
