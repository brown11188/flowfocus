"use client";
import { useState } from "react";
import { ArrowLeft, Building2, Check, CheckCircle2, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailableWorkspace } from "./types";

interface WorkspacePickerProps {
  workspaces: AvailableWorkspace[];
  saving: boolean;
  title?: string;
  subtitle?: string;
  /** Multi-select mode — sends array of selected workspaces */
  multiSelect?: boolean;
  onSelect: (ws: AvailableWorkspace) => void;
  onSelectMultiple?: (ws: AvailableWorkspace[]) => void;
  onBack: () => void;
}

export function WorkspacePicker({
  workspaces, saving, title = "Select Workspaces", subtitle,
  multiSelect = true, onSelect, onSelectMultiple, onBack,
}: WorkspacePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    workspaces.length === 1 ? new Set([workspaces[0].id]) : new Set()
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chosenWorkspaces = workspaces.filter((w) => selected.has(w.id));

  const displaySubtitle = subtitle ??
    (workspaces.length === 1
      ? "Found 1 workspace linked to your token."
      : `Found ${workspaces.length} workspaces. Choose which ones to connect.`);

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-2 py-2">
        <div className="w-12 h-12 rounded-full bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6 text-[#7B68EE]" />
        </div>
        <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">{displaySubtitle}</p>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        {workspaces.map((ws) => {
          const isSelected = selected.has(ws.id);
          const initial = ws.name.charAt(0).toUpperCase();
          return (
            <button
              key={ws.id}
              onClick={() => toggle(ws.id)}
              disabled={saving}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                isSelected
                  ? "border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-300/50 dark:ring-violet-700/50"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
              )}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: ws.color ?? "#7B68EE" }}
              >
                {ws.avatar
                  ? <img src={ws.avatar} alt={ws.name} className="w-full h-full object-cover" />
                  : initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{ws.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {ws.memberCount > 0 ? `${ws.memberCount} member${ws.memberCount !== 1 ? "s" : ""}` : "Workspace"}
                  </p>
                  {ws.isConnected && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      Connected
                    </span>
                  )}
                </div>
              </div>
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                isSelected ? "border-violet-500 bg-violet-500" : "border-gray-300 dark:border-gray-600"
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => {
          if (multiSelect && onSelectMultiple) {
            onSelectMultiple(chosenWorkspaces);
          } else if (chosenWorkspaces.length === 1) {
            onSelect(chosenWorkspaces[0]);
          }
        }}
        disabled={selected.size === 0 || saving}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
          : <><CheckCircle2 className="w-4 h-4" /> Connect {selected.size === 0 ? "selected workspace" : selected.size === 1 ? chosenWorkspaces[0].name : `${selected.size} workspaces`}</>}
      </button>
    </div>
  );
}
