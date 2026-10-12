import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QueueView, type QueueMessage } from "./QueueView";
import { activeModelLabel } from "@/lib/llm";

export const instant = false;

export default async function QueuePage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) return null;

  // Drafts waiting for the owner (RLS guarantees only this business's rows come back)
  const { data: pending, error } = await supabase
    .from("messages")
    .select(
      "id, subject, body, step, tone, used_fallback, guardrail_flagged, violations, created_at, invoices!inner(id, business_id, invoice_number, customer_name, customer_email, amount, currency, due_date, status)"
    )
    .eq("status", "pending_approval")
    .eq("invoices.business_id", business.id)
    .order("created_at", { ascending: true });

  if (error) console.error("[queue] load error:", error.message);

  const { count: approvedCount } = await supabase
    .from("messages")
    .select("id, invoices!inner(business_id)", { count: "exact", head: true })
    .eq("invoices.business_id", business.id)
    .in("status", ["approved", "sent"]);

  return (
    <QueueView
      initialMessages={(pending ?? []) as unknown as QueueMessage[]}
      approvedCount={approvedCount ?? 0}
      sendMode={business.send_mode || "approval"}
      modelLabel={activeModelLabel()}
      loadError={error?.message ?? null}
    />
  );
}
