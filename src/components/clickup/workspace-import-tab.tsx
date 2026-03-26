"use client";
import {
  Download, RefreshCw, Info, Loader2, Layers, CheckCircle2,
  FolderOpen, ListChecks, ChevronDown, ChevronRight, List,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MiniStat } from "./mini-stat";
import type { WorkspaceStructure, ImportResult, WorkspaceSpace } from "./types";

interface WorkspaceImportTabProps {
  workspace: WorkspaceStructure | null;
  loadingStructure: boolean;
  selectedSpaces: Set<string>;
  includeClosed: boolean;
  importing: boolean;
  importResult: ImportResult | null;
  onToggleSpace: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onIncludeClosedChange: (v: boolean) => void;
  onImport: () => void;
  onRefresh: () => void;
}

export function WorkspaceImportTab({
  workspace, loadingStructure, selectedSpaces, includeClosed,
  importing, importResult,
  onToggleSpace, onSelectAll, onDeselectAll, onIncludeClosedChange, onImport, onRefresh,
}: WorkspaceImportTabProps) {
  if (loadingStructure) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workspace structure…
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        Could not load workspace.{" "}
        <button onClick={onRefresh} className="text-violet-500 hover:underline">Retry</button>
      </div>
    );
  }

  const totalAllLists = workspace.spaces.reduce(
    (acc, s) => acc + (s.allLists?.length ?? s.lists.length), 0
  );

  return (
    <div className="space-y-5">
      {/* Workspace info */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
        <div className="w-9 h-9 rounded-xl bg-[#7B68EE] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {workspace.workspace.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-200 truncate">
            {workspace.workspace.name}
          </p>
          <p className="text-xs text-violet-600/70 dark:text-violet-400/70">
            {workspace.spaces.length} space{workspace.spaces.length !== 1 ? "s" : ""}
            {" · "}{totalAllLists} list{totalAllLists !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Info */}
      <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Each selected <strong>Space</strong> maps to a <strong>Project</strong> in FlowFocus.
          All tasks across <strong>Folders and Lists</strong> inside the Space will be imported.
          Importing is a <strong>one-way upsert</strong> — new tasks added, existing tasks updated.
          Your local notes and labels are preserved.
        </span>
      </div>

      {/* Space selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Select Spaces to import
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({selectedSpaces.size} of {workspace.spaces.length} selected)
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onSelectAll} className="text-xs text-violet-600 hover:underline">All</button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={onDeselectAll} className="text-xs text-gray-400 hover:text-gray-600">None</button>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {workspace.spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              selected={selectedSpaces.has(space.id)}
              onToggle={() => onToggleSpace(space.id)}
            />
          ))}
        </div>
      </div>

      {/* Options */}
      <label className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input type="checkbox" checked={includeClosed}
          onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
        Include completed / closed tasks
      </label>

      {/* Import CTA */}
      <button
        onClick={onImport}
        disabled={importing || selectedSpaces.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
      >
        {importing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Importing tasks…</>
        ) : (
          <><Download className="w-4 h-4" /> Import {selectedSpaces.size} Space{selectedSpaces.size !== 1 ? "s" : ""} into FlowFocus</>
        )}
      </button>

      {importResult && <ImportResultCard result={importResult} />}
    </div>
  );
}

// ─── SpaceCard: shows space with expandable folders/lists ─────────────────────

function SpaceCard({
  space, selected, onToggle,
}: {
  space: WorkspaceSpace;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allLists = space.allLists ?? space.lists;
  const folders = space.folders ?? [];
  const folderlessLists = (space.lists ?? []).filter((l) => !l.folderId);
  const hasFolders = folders.length > 0;
  const totalTasks = space.totalTasks ?? allLists.reduce((a, l) => a + (l.taskCount ?? 0), 0);
  const totalListCount = allLists.length;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        selected
          ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
          : "border-gray-200 dark:border-gray-700"
      )}
    >
      {/* Space header row */}
      <label className="flex items-center gap-3 p-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded text-violet-600"
        />
        <Layers className="w-4 h-4 text-violet-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{space.name}</p>
          <p className="text-xs text-gray-400">
            {hasFolders && <span>{folders.length} folder{folders.length !== 1 ? "s" : ""} · </span>}
            {totalListCount} list{totalListCount !== 1 ? "s" : ""}
            {totalTasks > 0 && <> · ~{totalTasks} tasks</>}
          </p>
        </div>
        {selected && <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />}
        {/* Expand toggle */}
        {(hasFolders || totalListCount > 0) && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
            className="ml-1 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </label>

      {/* Expanded: folders + folderless lists */}
      {expanded && (
        <div className="pb-2 px-3 space-y-1.5">
          {/* Folders */}
          {folders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} />
          ))}
          {/* Folderless lists */}
          {folderlessLists.length > 0 && (
            <div className="space-y-1">
              {hasFolders && (
                <p className="text-xs font-medium text-gray-400 pl-5 pt-1">Folderless Lists</p>
              )}
              {folderlessLists.map((list) => (
                <div key={list.id} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs text-gray-500 dark:text-gray-400 pl-6">
                  <List className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{list.name}</span>
                  {(list.taskCount ?? 0) > 0 && (
                    <span className="ml-auto text-gray-400">{list.taskCount}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderRow({
  folder,
}: {
  folder: { id: string; name: string; taskCount: number; lists: { id: string; name: string; taskCount: number }[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1.5 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="flex-1 text-left font-medium truncate">{folder.name}</span>
        <span className="text-gray-400">{folder.lists.length} list{folder.lists.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>
      {open && folder.lists.length > 0 && (
        <div className="py-1 bg-gray-50/50 dark:bg-gray-900/30">
          {folder.lists.map((list) => (
            <div key={list.id} className="flex items-center gap-2 py-1 px-2 pl-7 text-xs text-gray-500 dark:text-gray-400">
              <List className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="flex-1 truncate">{list.name}</span>
              {list.taskCount > 0 && <span className="text-gray-400">{list.taskCount}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportResultCard({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800/50 overflow-hidden">
      <div className="bg-green-50 dark:bg-green-950/30 px-4 py-2.5 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800 dark:text-green-300">Import Complete</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="New Tasks" value={result.importedCount} color="green" />
          <MiniStat label="Updated" value={result.updatedCount} color="blue" />
          <MiniStat label="Projects Created" value={result.projectsCreated} color="violet" />
          <MiniStat label="Projects Matched" value={result.projectsReused} color="gray" />
        </div>
        {result.spacesSynced.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.spacesSynced.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                <FolderOpen className="w-3 h-3" />{s}
              </span>
            ))}
          </div>
        )}
        {result.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{result.message}</p>
        )}
        {result.errors.length > 0 && (
          <details className="text-xs">
            <summary className="text-red-500 cursor-pointer">{result.errors.length} error{result.errors.length !== 1 ? "s" : ""}</summary>
            <ul className="mt-1 space-y-1 text-gray-500">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </details>
        )}
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <ListChecks className="w-3 h-3" />
          Reload the sidebar to see newly imported projects.
        </p>
      </div>
    </div>
  );
}
