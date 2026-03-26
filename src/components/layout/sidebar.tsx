"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTaskStore } from "@/store/task-store";
import { useTheme } from "next-themes";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, Calendar, Settings, LogOut, Zap,
  Moon, Sun, Monitor, Plus, ChevronDown, ChevronRight, Hash, FolderOpen,
  LayoutGrid, Sparkles, Link2,
} from "lucide-react";
import { AddProjectModal } from "@/components/tasks/add-project-modal";
import { QuickAddModal } from "@/components/tasks/quick-add-modal";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null; id?: string };
}

function ClickUpIconSmall({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <path d="M4.53 21.4L8.2 18.4c1.95 2.3 3.9 3.46 7.8 3.46s5.85-1.16 7.8-3.46l3.67 3c-2.73 3.2-6.4 4.87-11.47 4.87S7.26 24.6 4.53 21.4z" fill="#7B68EE"/>
      <path d="M4 11.2l3.78 2.87C9.9 11.5 12.7 10.1 16 10.1s6.1 1.4 8.22 3.97L28 11.2C25.13 7.7 20.9 5.67 16 5.67S6.87 7.7 4 11.2z" fill="#FF79C6"/>
    </svg>
  );
}

function MicrosoftIconSmall({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className}>
      <path fill="#f35325" d="M0 0h11v11H0z"/>
      <path fill="#81bc06" d="M12 0h11v11H12z"/>
      <path fill="#05a6f0" d="M0 12h11v11H0z"/>
      <path fill="#ffba08" d="M12 12h11v11H12z"/>
    </svg>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, tasks } = useTaskStore();
  const { theme, setTheme } = useTheme();
  const [showProjects, setShowProjects] = useState(true);
  const [showPlanning, setShowPlanning] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddProjectId, setQuickAddProjectId] = useState<string | undefined>(undefined);

  // Sort: Inbox first, then by sortOrder
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isInbox && !b.isInbox) return -1;
    if (!a.isInbox && b.isInbox) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  // Active task count per project (already filtered in API, use _count directly)
  const getActiveCount = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    return proj?._count?.tasks ?? 0;
  };

  const myWorkItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/today", icon: CalendarDays, label: "Today" },
    { href: "/upcoming", icon: Calendar, label: "Upcoming" },
  ];

  const planningItems = [
    { href: "/kanban", icon: LayoutGrid, label: "Kanban Board" },
  ];

  const handleProjectQuickAdd = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickAddProjectId(projectId);
    setShowQuickAdd(true);
  };

  const isIntegrationsActive = pathname.startsWith("/integrations") || pathname.startsWith("/clickup") || pathname.startsWith("/microsoft");

  return (
    <>
      <div className="w-64 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">FlowFocus</span>
          </div>
        </div>

        {/* Quick add + Friday */}
        <div className="p-3 flex gap-2">
          <button
            onClick={() => { setQuickAddProjectId(undefined); setShowQuickAdd(true); }}
            title="Add task (⌘K)"
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("friday:open"))}
            title="Ask Friday AI (⌘/)"
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white transition-all shadow-sm hover:shadow-md"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">

          {/* ── MY WORK section ── */}
          <div className="px-3 pt-1 pb-1.5">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">My Work</span>
          </div>
          {myWorkItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === href
                  ? "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          {/* ── PLANNING section ── */}
          <div className="pt-3">
            <button
              onClick={() => setShowPlanning(!showPlanning)}
              className="w-full flex items-center justify-between px-3 py-1.5 group"
            >
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Planning</span>
              {showPlanning
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {showPlanning && (
              <div className="space-y-0.5 mt-0.5">
                {planningItems.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href} href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                      pathname === href || pathname.startsWith(href + "?")
                        ? "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── PROJECTS section ── */}
          <div className="pt-3">
            <div
              className="flex items-center justify-between px-3 py-1.5 cursor-pointer group"
              onClick={() => setShowProjects(!showProjects)}
            >
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Projects</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddProject(true); }}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="New project"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {showProjects
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </div>
            {showProjects && (
              <div className="space-y-0.5 mt-0.5">
                {sortedProjects.map((project) => {
                  const activeCount = getActiveCount(project.id);
                  const isActive = pathname === "/projects/" + project.id || pathname.startsWith("/projects/" + project.id + "?");
                  return (
                    <div key={project.id} className="group relative">
                      <Link
                        href={"/projects/" + project.id}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        {project.isInbox
                          ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: project.color }} />
                          : <Hash className="w-3.5 h-3.5 flex-shrink-0" style={{ color: project.color }} />
                        }
                        <span className="truncate flex-1">{project.name}</span>
                        {/* Quick add button (hover) */}
                        {!project.isInbox && (
                          <button
                            onClick={(e) => handleProjectQuickAdd(e, project.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900 text-gray-400 hover:text-violet-600 transition-all flex-shrink-0"
                            title="Add task to project"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        {/* Active count badge (shown when no hover) */}
                        {activeCount > 0 && (
                          <span className={cn(
                            "text-xs text-gray-400 flex-shrink-0 transition-opacity",
                            "group-hover:opacity-0"
                          )}>
                            {activeCount}
                          </span>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom bar — fixed */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          {/* Integrations row */}
          <div className="px-3 pt-3 pb-1 space-y-0.5">
            <p className="px-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Integrations</p>
            <Link
              href="/integrations"
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                isIntegrationsActive
                  ? "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">Integrations</span>
              <div className="flex items-center gap-1">
                <ClickUpIconSmall className="w-3 h-3" />
                <MicrosoftIconSmall className="w-3 h-3" />
              </div>
            </Link>
          </div>

          {/* Settings + Theme + User */}
          <div className="p-3 space-y-1">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === "/settings"
                  ? "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            {/* Theme selector */}
            <div className="px-3 py-1">
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {([
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "Auto" },
                ] as const).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    title={label}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
                      theme === value
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User row */}
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300">
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{user.name}</div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: `${typeof window !== "undefined" ? window.location.origin : ""}${basePath}/login` })}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} />}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => { setShowQuickAdd(false); setQuickAddProjectId(undefined); }}
          defaultProjectId={quickAddProjectId}
        />
      )}
    </>
  );
}
