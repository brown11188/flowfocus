import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-violet-200 dark:bg-violet-900/20 rounded-full blur-3xl opacity-40 -translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200 dark:bg-indigo-900/20 rounded-full blur-3xl opacity-30 translate-x-1/4 translate-y-1/4" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-100 dark:bg-pink-900/10 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full flex flex-col items-center">
        {children}

        {/* Footer tagline */}
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Zap className="w-3 h-3" />
          AI-powered productivity, beautifully simple
        </p>
      </div>
    </div>
  );
}
