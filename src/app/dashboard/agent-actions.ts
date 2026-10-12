"use server";

/**
 * agent-actions.ts — every button that changes agent/invoice state calls one of these.
 * All run on the server with the logged-in user's session, so Row-Level Security
 * guarantees a business can only touch its own data.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  draftForInvoice,
  runDraftingForBusiness,
  buildContext,
  CLOSED_STATUSES,
  type BusinessRow,
  type InvoiceRow,
  type Tone,
} from "@/services/drafting";
import { checkEmailGuardrails } from "@/lib/guardrails";
import { logAudit } from "@/lib/audit";

const AUTOPILOT_MIN_APPROVALS = 5;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; violations?: string[] };

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You are not signed in.");
  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) throw new Error("Finish onboarding first.");
  return { supabase, business: business as BusinessRow & { send_mode: string } };
}

function refreshAll() {
  for (const p of ["/dashboard", "/dashboard/queue", "/dashboard/attention", "/dashboard/invoices"]) {
    revalidatePath(p);
  }
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** "Run agent now" — drafts every message that's due according to the schedule. */
export async function runAgentNow(): Promise<Result<{ drafted: number; needsAttention: number; skipped: number }>> {
  try {
    const { supabase, business } = await getContext();
    const res = await runDraftingForBusiness(supabase, business);
    if (res.errors.length) return { ok: false, error: res.errors.join("; ") };
    refreshAll();
    return { ok: true, drafted: res.drafted, needsAttention: res.needsAttention, skipped: res.skipped };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Owner asks the AI to draft a reminder for one invoice right now. */
export async function createDraftForInvoice(invoiceId: string, tone: Tone): Promise<Result<{ usedFallback: boolean }>> {
  try {
    const { supabase, business } = await getContext();
    const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    if (!invoice) return { ok: false, error: "Invoice not found." };
    const res = await draftForInvoice(supabase, business, invoice as InvoiceRow, {
      step: "Manual",
      tone,
      actor: "owner",
    });
    if (!res.ok) return { ok: false, error: res.reason };
    refreshAll();
    return { ok: true, usedFallback: res.usedFallback };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Internal: approve one message (optionally with owner edits). Re-runs the guardrail checker. */
async function approveOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  business: BusinessRow,
  messageId: string,
  edits?: { subject: string; body: string }
): Promise<Result> {
  const { data: msg } = await supabase.from("messages").select("*, invoices(*)").eq("id", messageId).single();
  if (!msg) return { ok: false, error: "Message not found." };
  if (msg.status !== "pending_approval") return { ok: false, error: "This message was already handled." };

  const invoice = msg.invoices as InvoiceRow;
  if (CLOSED_STATUSES.includes(invoice.status)) {
    return { ok: false, error: `Invoice is ${invoice.status}. Skip this draft instead.` };
  }

  const subject = (edits?.subject ?? msg.subject ?? "").trim();
  const body = (edits?.body ?? msg.body ?? "").trim();
  const check = checkEmailGuardrails(subject, body, buildContext(business, invoice, msg.step));
  if (!check.passed) {
    return { ok: false, error: "This email can't be approved yet.", violations: check.violations };
  }

  const wasEdited = !!edits && (edits.subject.trim() !== msg.subject || edits.body.trim() !== msg.body);

  const { error } = await supabase
    .from("messages")
    .update({ subject, body, status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) return { ok: false, error: error.message };

  if (wasEdited) {
    await logAudit(supabase, {
      business_id: business.id,
      invoice_id: invoice.id,
      action: "message_edited",
      actor: "owner",
      details: { message_id: messageId, previous_subject: msg.subject, previous_body: msg.body },
    });
  }
  await logAudit(supabase, {
    business_id: business.id,
    invoice_id: invoice.id,
    action: "message_approved",
    actor: "owner",
    details: { message_id: messageId, step: msg.step },
  });
  return { ok: true };
}

export async function approveMessage(messageId: string, edits?: { subject: string; body: string }): Promise<Result> {
  try {
    const { supabase, business } = await getContext();
    const res = await approveOne(supabase, business, messageId, edits);
    if (res.ok) refreshAll();
    return res;
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveAll(): Promise<Result<{ approved: number; failed: number }>> {
  try {
    const { supabase, business } = await getContext();
    const { data: pending } = await supabase
      .from("messages")
      .select("id, invoices!inner(business_id)")
      .eq("status", "pending_approval")
      .eq("invoices.business_id", business.id);

    let approved = 0;
    let failed = 0;
    for (const m of pending ?? []) {
      const r = await approveOne(supabase, business, m.id);
      if (r.ok) approved++;
      else failed++;
    }
    refreshAll();
    return { ok: true, approved, failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function skipMessage(messageId: string): Promise<Result> {
  try {
    const { supabase, business } = await getContext();
    const { data: msg } = await supabase.from("messages").select("id, invoice_id, status, step").eq("id", messageId).single();
    if (!msg) return { ok: false, error: "Message not found." };
    const { error } = await supabase
      .from("messages")
      .update({ status: "skipped", updated_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, {
      business_id: business.id,
      invoice_id: msg.invoice_id,
      action: "message_skipped",
      actor: "owner",
      details: { message_id: messageId, step: msg.step },
    });
    refreshAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** How many messages the owner has approved (or sent). Used to unlock Autopilot. */
export async function getApprovedCount(): Promise<number> {
  const { supabase, business } = await getContext();
  const { count } = await supabase
    .from("messages")
    .select("id, invoices!inner(business_id)", { count: "exact", head: true })
    .eq("invoices.business_id", business.id)
    .in("status", ["approved", "sent"]);
  return count ?? 0;
}

/** Approval mode is the default. Autopilot unlocks only after 5 approvals + explicit confirmation. */
export async function setSendMode(mode: "approval" | "autopilot", confirmed = false): Promise<Result<{ mode: string }>> {
  try {
    const { supabase, business } = await getContext();
    if (mode === "autopilot") {
      const approvedCount = await getApprovedCount();
      if (approvedCount < AUTOPILOT_MIN_APPROVALS) {
        return {
          ok: false,
          error: `Approve at least ${AUTOPILOT_MIN_APPROVALS} messages first (you've approved ${approvedCount}).`,
        };
      }
      if (!confirmed) return { ok: false, error: "Please confirm you want the agent to send without your review." };
    }
    const { error } = await supabase.from("businesses").update({ send_mode: mode }).eq("id", business.id);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, {
      business_id: business.id,
      action: "send_mode_changed",
      actor: "owner",
      details: { from: business.send_mode, to: mode },
    });
    refreshAll();
    return { ok: true, mode };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Change an invoice's status. Paid / disputed / paused instantly cancel every
 * queued or approved-but-unsent message for that invoice.
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "paid" | "disputed" | "paused" | "active",
  opts: { amountPaid?: number } = {}
): Promise<Result<{ status: string }>> {
  try {
    const { supabase, business } = await getContext();
    const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    if (!invoice) return { ok: false, error: "Invoice not found." };

    const today = new Date().toISOString().slice(0, 10);
    let newStatus: string = status;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status === "active") {
      // Resume: recompute whether it's upcoming or overdue
      newStatus = invoice.due_date < today ? "overdue" : "upcoming";
      update.paused_until = null;
    }
    if (status === "paid") {
      const amt = opts.amountPaid ?? Number(invoice.amount);
      update.amount_paid = amt;
      update.paid_at = new Date().toISOString();
      if (amt < Number(invoice.amount)) {
        // Partial payment: stop reminders and let the owner decide what to do next.
        newStatus = "paused";
        update.needs_attention = true;
      }
    }
    if (status === "disputed") update.needs_attention = true;
    update.status = newStatus;

    const { error } = await supabase.from("invoices").update(update).eq("id", invoiceId);
    if (error) return { ok: false, error: error.message };

    await logAudit(supabase, {
      business_id: business.id,
      invoice_id: invoiceId,
      action: "status_changed",
      actor: "owner",
      details: { from: invoice.status, to: newStatus, amount_paid: update.amount_paid ?? null },
    });

    if (CLOSED_STATUSES.includes(newStatus)) {
      const { data: cancelled } = await supabase
        .from("messages")
        .update({ status: "skipped", updated_at: new Date().toISOString() })
        .eq("invoice_id", invoiceId)
        .in("status", ["pending_approval", "approved"])
        .select("id");
      if (cancelled && cancelled.length) {
        await logAudit(supabase, {
          business_id: business.id,
          invoice_id: invoiceId,
          action: "pending_messages_cancelled",
          actor: "system",
          details: { count: cancelled.length, reason: `Invoice marked ${newStatus}` },
        });
      }
    }

    refreshAll();
    return { ok: true, status: newStatus };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateMessageBody(messageId: string, newBody: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("messages").update({ body: newBody }).eq("id", messageId);
  if (error) return { ok: false, error: error.message };
  refreshAll();
  return { ok: true };
}
