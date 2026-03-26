"use client";
import { useState } from "react";
import { Task } from "@/types";
import { cn, formatDate, isOverdue, PRIORITY_CONFIG } from "@/lib/utils";
import { Flag, ChevronRight, GripVertical, RefreshCw, Lock, Clock } from "lucide-react";
import { ClickUpBadge } from "@/components/clickup/clickup-badge";
import { TaskDetailPanel } from "./task-detail-panel";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";

interface TaskItemProps {
  task: Task;
  onComplete: (id: string, completed: boolean) => void;
  onEdit: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
  compact?: boolean;
}

export function TaskItem({ task, onComplete, onEdit, onDelete, draggable = false, compact = false }: TaskItemProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { timezone } = useTimezoneCtx();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const overdueDate = task.dueDate && !task.completed && isOverdue(task.dueDate, timezone);
  const isBlocked = task.blockedBy && task.blockedBy.length > 0 && task.blockedBy.some(d => !d.blockingTask?.completed);
  const isRecurring = !!task.recurrenceRule;

  return (
    <>
      <div
        ref={setNodeRef} style={style}
        className={cn(
          "group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
          task.completed && "opacity-50",
          isDragging && "opacity-30 bg-violet-50 dark:bg-violet-950",
          isBlocked && !task.completed && "border-l-2 border-amber-400"
        )}
      >
        {draggable && (
          <button {...attributes} {...listeners} className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-opacity">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onComplete(task.id, !task.completed)}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
            task.completed
              ? "bg-violet-500 border-violet-500"
              : priority.color.replace("text-", "border-") + " hover:bg-violet-100 dark:hover:bg-violet-900"
          )}
        >
          {task.completed && (
            <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
              <path d="M3 8l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setShowDetail(true)}
            className={cn(
              "text-sm text-left w-full",
              task.completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"
            )}
          >
            {task.title}
          </button>
          {!compact && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {task.project && !task.project.isInbox && (
                <span className="text-xs" style={{ color: task.project.color }}>
                  {task.project.name}
                </span>
              )}
              {task.dueDate && (
                <span className={cn("text-xs", overdueDate ? "text-red-500 font-medium" : "text-gray-400")}>
                  {overdueDate ? "⚠ " : ""}{formatDate(task.dueDate)}
                </span>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                <span className="text-xs text-gray-400">
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                </span>
              )}
              {isBlocked && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> Blocked
                </span>
              )}
              {isRecurring && (
                <span className="text-xs text-violet-500 flex items-center gap-0.5">
                  <RefreshCw className="w-3 h-3" />
                </span>
              )}
              {task.estimatedHours && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />{task.estimatedHours}h
                </span>
              )}
              {task.clickupTaskId && (
                <ClickUpBadge url={task.clickupUrl} status={task.clickupStatus} />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Flag className={cn("w-3.5 h-3.5 flex-shrink-0", priority.color)} />
          <button onClick={() => setShowDetail(true)} className="text-gray-400 hover:text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showDetail && (
        <TaskDetailPanel
          task={task}
          onClose={() => setShowDetail(false)}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
