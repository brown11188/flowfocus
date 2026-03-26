import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { DataProvider } from "@/components/layout/data-provider";
import { FridayWidget } from "@/components/friday/friday-widget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <DataProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <Sidebar user={session.user} />
        {/* On mobile, push content right of the hamburger button */}
        <main className="flex-1 overflow-auto min-w-0 pt-0 lg:pt-0">
          <div className="lg:hidden h-12" />{/* spacer for mobile hamburger */}
          {children}
        </main>
      </div>
      <FridayWidget />
    </DataProvider>
  );
}
