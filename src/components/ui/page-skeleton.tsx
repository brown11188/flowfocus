export function PageSkeleton() {
  return (
    <div className="animate-pulse p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800/50 rounded mt-1.5" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}