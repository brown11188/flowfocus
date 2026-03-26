import { Suspense } from "react";
import MicrosoftHubClient from "./client-page";

export default function MicrosoftHubPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MicrosoftHubClient />
    </Suspense>
  );
}
