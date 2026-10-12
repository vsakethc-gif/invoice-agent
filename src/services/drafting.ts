/**
 * drafting.ts — the "agent brain" for Phase 3.
 *
 * runDraftingForBusiness(): looks at every open invoice, asks the schedule engine
 * which step is due, and writes a draft into the Approval Queue.
 * Nothing is SENT here — sending happens only after approval (Phase 4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNextStep } from "@/utils/schedule";
import { generateDraftEmail, type Tone } from "@/lib/llm";
import { logAudit } from "@/lib/audit";
import type { InvoiceContext } from "@/lib/guardrails";

export type { Tone };

// Default tone escalation per schedule step
export const STEP_TONE: Record<string, Tone> = {
  "Day -3": "Friendly",
  "Day +1": "Friendly",
  "Day +7": "Professional",
  "Day +14": "Firm",
  "Day +30": "Firm",
};

// Statuses where the agent must never draft or send anything
export const CLOSED_STATUSES = ["paid", "disputed", "paused"];

export interface BusinessRow {
  id: string;
  name: string;
  owner_name: string;
  default_tone?: string | null;
  default_payment_link?: string | null;
  timezone?: string | null;
  grace_period_days?: number;
  minimum_chase_amount?: number;
  bcc_email?: string | null;
}

export interface InvoiceRow {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency?: string | null;
  due_date: string;
  status: string;
  payment_link?: string | null;
  paused_until?: string | null;
  needs_attention?: boolean | null;
}

export function daysOverdue(dueDate: string, now = new Date()): number {
  const due = new Date(`${dueDate}T00:00:00Z`);
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000);
}

export function buildContext(business: BusinessRow, invoice: InvoiceRow, step?: string): InvoiceContext {
  return {
    invoice_number: invoice.invoice_number,
    amount: Number(invoice.amount),
    currency: invoice.currency || "USD",
    due_date: invoice.due_date,
    payment_link: invoice.payment_link || business.default_payment_link || undefined,
    business_name: business.name,
    owner_name: business.owner_name,
    customer_name: invoice.customer_name,
    step,
  };
}

export async function isSuppressed(supabase: SupabaseClient, businessId: string, email: string) {
  const { data } = await supabase
    .from("suppressions")
    .select("id")
    .eq("business_id", businessId)
    .ilike("email", email.trim())
    .limit(1);
  return !!data && data.length > 0;
}

/** Drafts one message for one invoice and puts it in the Approval Queue. */
export async function draftForInvoice(
  supabase: SupabaseClient,
  business: BusinessRow,
  invoice: InvoiceRow,
  opts: { step: string; tone?: Tone; actor: "owner" | "agent" }
): Promise<{ ok: true; messageId: string; usedFallback: boolean } | { ok: false; reason: string }> {
  if (CLOSED_STATUSES.includes(invoice.status)) {
    return { ok: false, reason: `Invoice is ${invoice.status} — no reminders will be drafted.` };
  }
  if (await isSuppressed(supabase, business.id, invoice.customer_email)) {
    return { ok: false, reason: "This customer opted out of reminders." };
  }

  const { data: pending } = await supabase
    .from("messages")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("status", "pending_approval")
    .limit(1);
  if (pending && pending.length > 0) {
    return { ok: false, reason: "A draft for this invoice is already waiting in the Approval Queue." };
  }

  const { data: prior } = await supabase
    .from("messages")
    .select("direction, body")
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: true });

  const tone: Tone =
    opts.tone ?? STEP_TONE[opts.step] ?? ((business.default_tone as Tone) || "Professional");
  const context = buildContext(business, invoice, opts.step);

  const draft = await generateDraftEmail({
    context,
    days_overdue: daysOverdue(invoice.due_date),
    tone,
    step: opts.step,
    prior_messages: prior ?? [],
  });

  // Only flag when the AI misbehaved (not when we simply have no API key)
  const flagged = draft.fallback_reason === "guardrail_violation" || draft.fallback_reason === "llm_error";

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      invoice_id: invoice.id,
      direction: "outbound",
      subject: draft.subject,
      body: draft.body,
      type: "draft",
      status: "pending_approval",
      step: opts.step,
      tone,
      used_fallback: draft.used_fallback,
      guardrail_flagged: flagged,
      violations: draft.violations,
    })
    .select("id")
    .single();

  if (error || !msg) return { ok: false, reason: error?.message || "Could not save draft." };

  await logAudit(supabase, {
    business_id: business.id,
    invoice_id: invoice.id,
    action: "message_drafted",
    actor: opts.actor,
    details: {
      message_id: msg.id,
      step: opts.step,
      tone,
      source: draft.used_fallback ? `template (${draft.fallback_reason})` : "ai",
      attempts: draft.attempts,
    },
  });

  if (flagged) {
    await logAudit(supabase, {
      business_id: business.id,
      invoice_id: invoice.id,
      action: "guardrail_fallback_used",
      actor: "system",
      details: { message_id: msg.id, violations: draft.violations },
    });
  }

  return { ok: true, messageId: msg.id, usedFallback: draft.used_fallback };
}

/** Scans all open invoices for a business and drafts whatever step is due. */
export async function runDraftingForBusiness(supabase: SupabaseClient, business: BusinessRow) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = { drafted: 0, needsAttention: 0, skipped: 0, errors: [] as string[] };

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("business_id", business.id)
    .not("status", "in", `(${CLOSED_STATUSES.join(",")})`);

  if (error) {
    summary.errors.push(error.message);
    return summary;
  }

  for (const inv of (invoices ?? []) as InvoiceRow[]) {
    // Promise-to-pay pause, or already handed to the owner
    if ((inv.paused_until && inv.paused_until >= today) || inv.needs_attention) {
      summary.skipped++;
      continue;
    }

    // Ignore small amounts
    if (business.minimum_chase_amount && Number(inv.amount) < business.minimum_chase_amount) {
      summary.skipped++;
      continue;
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("step, status, direction, created_at")
      .eq("invoice_id", inv.id);

    const outbound = (msgs ?? []).filter((m) => m.direction === "outbound" && m.status !== "skipped");
    const step = computeNextStep(inv, outbound);

    if (!step) {
      summary.skipped++;
      continue;
    }

    // Apply grace period for overdue invoices
    if (business.grace_period_days && step.startsWith("Day +")) {
      const daysOver = daysOverdue(inv.due_date);
      if (daysOver < business.grace_period_days) {
        summary.skipped++;
        continue;
      }
    }

    if (step === "Needs Attention") {
      // Only hand off once the final notice has actually been sent
      const finalSent = outbound.some((m) => m.step === "Day +30" && m.status === "sent");
      if (!finalSent) {
        summary.skipped++;
        continue;
      }
      await supabase.from("invoices").update({ needs_attention: true }).eq("id", inv.id);
      await logAudit(supabase, {
        business_id: business.id,
        invoice_id: inv.id,
        action: "marked_needs_attention",
        actor: "agent",
        details: { reason: "Follow-up schedule finished without payment. Owner should follow up personally." },
      });
      summary.needsAttention++;
      continue;
    }

    const result = await draftForInvoice(supabase, business, inv, { step, actor: "agent" });
    if (result.ok) summary.drafted++;
    else summary.skipped++;
  }

  return summary;
}
