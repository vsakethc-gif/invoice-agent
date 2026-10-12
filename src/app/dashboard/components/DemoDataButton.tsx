"use client";

import { useTransition } from "react";
import { loadDemoInvoices } from "../actions";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function DemoDataButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleLoadDemo = () => {
    startTransition(async () => {
      const res = await loadDemoInvoices();
      if (res?.error) {
        alert("Error loading demo data: " + res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <button
      onClick={handleLoadDemo}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-3 py-2 border border-purple-200 shadow-sm text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition"
      title="Loads sample invoices across all statuses (overdue, paid, disputed) for instant demo"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
      ) : (
        <Sparkles className="w-4 h-4 text-purple-600" />
      )}
      {isPending ? "Loading Demo Data..." : "Load Demo Data"}
    </button>
  );
}
