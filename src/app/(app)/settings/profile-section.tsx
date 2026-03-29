"use client";
import { useState } from "react";
import { User, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "#7c3aed", "#ec4899", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
];

interface ProfileSectionProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onNameChange?: (name: string) => void;
}

export function ProfileSection({ user, onNameChange }: ProfileSectionProps) {
  const [name, setName] = useState(user.name || "");
  const [avatarColor, setAvatarColor] = useState(() => {
    if (typeof window === "undefined") return AVATAR_COLORS[0];
    return localStorage.getItem("flowfocus_avatar_color") || AVATAR_COLORS[0];
  });
  const [workStart, setWorkStart] = useState(() => {
    if (typeof window === "undefined") return "09:00";
    return localStorage.getItem("flowfocus_work_start") || "09:00";
  });
  const [workEnd, setWorkEnd] = useState(() => {
    if (typeof window === "undefined") return "18:00";
    return localStorage.getItem("flowfocus_work_end") || "18:00";
  });
  const [saving, setSaving] = useState(false);

  const initials = (name || user.email || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      localStorage.setItem("flowfocus_avatar_color", avatarColor);
      localStorage.setItem("flowfocus_work_start", workStart);
      localStorage.setItem("flowfocus_work_end", workEnd);
      toast.success("Profile updated");
      onNameChange?.(name);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Avatar</label>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ backgroundColor: avatarColor }}
          >
            {user.image ? (
              <img src={user.image} alt="avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-all",
                  avatarColor === color
                    ? "border-white dark:border-gray-300 ring-2 ring-violet-500 scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
          <User className="w-3.5 h-3.5 inline mr-1.5" />
          Display Name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="Your name"
        />
      </div>

      {/* Working Hours */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Working Hours
        </label>
        <p className="text-xs text-gray-400 mb-2">Used by AI for scheduling suggestions</p>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={workStart}
            onChange={e => setWorkStart(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="text-gray-400">to</span>
          <input
            type="time"
            value={workEnd}
            onChange={e => setWorkEnd(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Email</label>
        <input
          value={user.email || ""}
          disabled
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}