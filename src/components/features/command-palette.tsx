"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/store/task-store";
import { cn } from "@/lib/utils";
import {
  Search, Calendar, LayoutDashboard, CalendarDays, BarChart3, LayoutGrid,
  BriefcaseBusiness, Plus, Sparkles, Timer, ArrowRight, Hash, FolderOpen,
  FileText, ShieldAlert, Link2, Settings, Flag,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigation" | "action" | "task" | "project";
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { tasks, projects } = useTaskStore();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    // custom event from other components
    const openHandler = () => setOpen(true);
    window.addEventListener("command-palette:open", openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("command-palette:open", openHandler);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const navigationItems: CommandItem[] = useMemo(() => [
    { id: "nav-dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, action: () => { router.push("/dashboard"); close(); }, category: "navigation", keywords: "home main" },
    { id: "nav-today", label: "Today", icon: <CalendarDays className="w-4 h-4" />, action: () => { router.push("/today"); close(); }, category: "navigation", keywords: "tasks due" },
    { id: "nav-upcoming", label: "Upcoming", icon: <Calendar className="w-4 h-4" />, action: () => { router.push("/upcoming"); close(); }, category: "navigation", keywords: "future schedule" },
    { id: "nav-weekly", label: "Weekly Review", icon: <BarChart3 className="w-4 h-4" />, action: () => { router.push("/weekly"); close(); }, category: "navigation", keywords: "review stats" },
    { id: "nav-kanban", label: "Kanban Board", icon: <LayoutGrid className="w-4 h-4" />, action: () => { router.push("/kanban"); close(); }, category: "navigation", keywords: "board columns" },
    { id: "nav-pm", label: "PM Workspace", icon: <BriefcaseBusiness className="w-4 h-4" />, action: () => { router.push("/pm"); close(); }, category: "navigation", keywords: "project management risks" },
    { id: "nav-integrations", label: "Integrations", icon: <Link2 className="w-4 h-4" />, action: () => { router.push("/integrations"); close(); }, category: "navigation", keywords: "clickup microsoft" },
    { id: "nav-settings", label: "Settings", icon: <Settings className="w-4 h-4" />, action: () => { router.push("/settings"); close(); }, category: "navigation", keywords: "profile timezone" },
  ], [router, close]);

  const actionItems: CommandItem[] = useMemo(() => [
    { id: "act-newtask", label: "New task", description: "Create a new task", icon: <Plus className="w-4 h-4 text-violet-500" />, action: () => { window.dispatchEvent(new CustomEvent("quick-capture:open")); close(); }, category: "action", keywords: "add create" },
    { id: "act-focus", label: "Start Focus session", description: "Begin a focus timer", icon: <Timer className="w-4 h-4 text-green-500" />, action: () => { window.dispatchEvent(new CustomEvent("focus-timer:open-setup")); close(); }, category: "action", keywords: "timer pomodoro" },
    { id: "act-friday", label: "Ask Friday AI", description: "Chat with AI assistant", icon: <Sparkles className="w-4 h-4 text-indigo-500" />, action: () => { window.dispatchEvent(new CustomEvent("friday:open")); close(); }, category: "action", keywords: "ai chat assistant" },
    { id: "act-risk", label: "Log a risk", description: "Add risk to PM workspace", icon: <ShieldAlert className="w-4 h-4 text-red-500" />, action: () => { router.push("/pm?tab=risks"); close(); }, category: "action", keywords: "risk danger" },
    { id: "act-report", label: "Generate status report", icon: <FileText className="w-4 h-4 text-blue-500" />, action: () => { router.push("/pm?tab=reports"); close(); }, category: "action", keywords: "report status" },
  ], [router, close]);

  const taskItems: CommandItem[] = useMemo(() =>
    tasks
      .filter(t => !t.isDeleted && !t.completed)
      .slice(0, 50)
      .map(t => ({
        id: `task-${t.id}`,
        label: t.title,
        description: t.project?.name || undefined,
        icon: <Flag className={cn("w-3.5 h-3.5", t.priority === 1 ? "text-red-500" : t.priority === 2 ? "text-orange-500" : t.priority === 3 ? "text-blue-500" : "text-gray-400")} />,
        action: () => {
          // Navigate to today or project
          if (t.projectId) router.push(`/projects/${t.projectId}`);
          else router.push("/today");
          close();
        },
        category: "task" as const,
        keywords: `${t.title} ${t.project?.name ?? ""}`,
      })),
    [tasks, router, close]
  );

  const projectItems: CommandItem[] = useMemo(() =>
    projects
      .filter(p => !p.isInbox)
      .map(p => ({
        id: `proj-${p.id}`,
        label: p.name,
        icon: <Hash className="w-3.5 h-3.5" style={{ color: p.color }} />,
        action: () => { router.push(`/projects/${p.id}`); close(); },
        category: "project" as const,
        keywords: p.name,
      })),
    [projects, router, close]
  );

  const allItems = useMemo(() => [
    ...navigationItems,
    ...actionItems,
    ...projectItems,
    ...taskItems,
  ], [navigationItems, actionItems, projectItems, taskItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [...navigationItems, ...actionItems].slice(0, 10);
    const q = query.toLowerCase();
    return allItems
      .filter(item => {
        const searchable = `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase();
        return searchable.includes(q);
      })
      .slice(0, 15);
  }, [query, allItems, navigationItems, actionItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  const grouped = {
    navigation: filtered.filter(i => i.category === "navigation"),
    action: filtered.filter(i => i.category === "action"),
    project: filtered.filter(i => i.category === "project"),
    task: filtered.filter(i => i.category === "task"),
  };

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Palette */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, navigate, or take action…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No results found</div>
            )}

            {(["navigation", "action", "project", "task"] as const).map(cat => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              const label = cat === "navigation" ? "Navigate" : cat === "action" ? "Actions" : cat === "project" ? "Projects" : "Tasks";
              return (
                <div key={cat}>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
                  </div>
                  {items.map(item => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                          idx === selectedIndex
                            ? "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        )}
                      >
                        <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{item.label}</span>
                          {item.description && <span className="text-xs text-gray-400 truncate block">{item.description}</span>}
                        </span>
                        {idx === selectedIndex && <ArrowRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
            <span className="ml-auto">⌘K to toggle</span>
          </div>
        </div>
      </div>
    </>
  );
}