"use client";
import { useState } from "react";
import {
  Plug, Eye, EyeOff, Info, KeyRound, Loader2, Zap, AlertCircle,
} from "lucide-react";

interface ConnectFormProps {
  connectingOAuth: boolean;
  showTokenForm: boolean;
  tokenInput: string;
  verifyingToken: boolean;
  onOAuthConnect: () => void;
  onToggleTokenForm: () => void;
  onTokenChange: (v: string) => void;
  onVerifyToken: () => void;
  onCancelToken: () => void;
}

export function ConnectForm({
  connectingOAuth, showTokenForm, tokenInput, verifyingToken,
  onOAuthConnect, onToggleTokenForm, onTokenChange, onVerifyToken, onCancelToken,
}: ConnectFormProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Plug className="w-7 h-7 text-[#7B68EE]" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-lg">Connect your ClickUp account</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
            Choose how to authenticate to start importing tasks and generating workspace reports.
          </p>
        </div>

        {/* OAuth */}
        <button
          onClick={onOAuthConnect}
          disabled={connectingOAuth}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          {connectingOAuth
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to ClickUp…</>
            : <><Zap className="w-4 h-4" /> Connect via OAuth (recommended)</>}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span>or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        <button
          onClick={onToggleTokenForm}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          {showTokenForm ? "Hide Personal API Token form" : "Use Personal API Token"}
        </button>
      </div>

      {/* Token form */}
      {showTokenForm && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-4">
          <div className="flex gap-2.5 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <Info className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
            <span>
              Go to{" "}
              <a href="https://app.clickup.com/settings/apps" target="_blank" rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 font-medium hover:underline">
                ClickUp → Settings → Apps
              </a>
              {" "}and copy your <strong>Personal API Token</strong>. Starts with{" "}
              <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px]">pk_</code>.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Personal API Token
            </label>
            <div className="relative">
              <input
                type={showRaw ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => onTokenChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && tokenInput.trim()) onVerifyToken(); }}
                placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
              <button type="button" onClick={() => setShowRaw((v) => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {tokenInput && !tokenInput.trim().startsWith("pk_") && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Personal tokens usually start with <code className="font-mono">pk_</code>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onVerifyToken}
              disabled={verifyingToken || !tokenInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {verifyingToken
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><KeyRound className="w-4 h-4" /> Load Workspaces</>}
            </button>
            <button onClick={onCancelToken}
              className="px-4 py-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
