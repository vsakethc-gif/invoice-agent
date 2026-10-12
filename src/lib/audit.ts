/**
 * audit.ts — append-only audit log helper.
 * The database policy only allows INSERT and SELECT on audit_logs, so entries
 * can never be edited or deleted from the app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Actor = "owner" | "agent" | "system";

export interface AuditEntry {
  business_id: string;
  invoice_id?: string | null;
  action: string; // e.g. message_drafted, message_approved, status_changed
  actor: Actor;
  details?: Record<string, unknown>;
}

export async function logAudit(supabase: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    business_id: entry.business_id,
    invoice_id: entry.invoice_id ?? null,
    action: entry.action,
    actor: entry.actor,
    details: entry.details ?? {},
  });
  // Never block the user's action because logging failed, but make it visible.
  if (error) console.error("[audit] failed to write entry:", entry.action, error.message);
}
