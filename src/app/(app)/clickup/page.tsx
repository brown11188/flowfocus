import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClickUpIntegrationPage } from "@/components/clickup/clickup-hub";

export const dynamic = "force-dynamic";

export default async function ClickUpPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ClickUpIntegrationPage />;
}
