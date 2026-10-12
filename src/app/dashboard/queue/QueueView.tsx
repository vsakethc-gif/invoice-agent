"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { playPop, playSuccess } from "@/utils/sfx";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Check,
  X,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Inbox,
  Zap,
  Lock,
  Unlock,
  CheckCheck,
} from "lucide-react";
import {
  approveMessage,
  approveAll,
  skipMessage,
  runAgentNow,
  setSendMode,
  updateMessageBody,
} from "../agent-actions";

export interface QueueMessage {
  id: string;
  subject: string;
  body: string;
  step: string;
  tone: string | null;
  used_fallback: boolean;
  guardrail_flagged: boolean;
  violations: string[] | null;
  created_at: string;
  invoices: {
    id: string;
    invoice_number: string;
    customer_name: string;
    customer_email: string;
    amount: number;
    currency: string | null;
    due_date: string;
    status: string;
  };
}

const AUTOPILOT_MIN = 5;

export function QueueView({
  initialMessages,
  approvedCount,
  sendMode,
  modelLabel,
  loadError,
}: {
  initialMessages: QueueMessage[];
  approvedCount: number;
  sendMode: string;
  modelLabel: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [approved, setApproved] = useState(approvedCount);
  const [mode, setMode] = useState(sendMode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<{ subject: string; body: string }>({ subject: "", body: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showAutopilotConfirm, setShowAutopilotConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Keep local list in sync when the server sends fresh data
  const [lastInitial, setLastInitial] = useState(initialMessages);
  if (initialMessages !== lastInitial) {
    setLastInitial(initialMessages);
    setMessages(initialMessages);
    setApproved(approvedCount);
  }

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const removeLocal = (id: string) => setMessages((prev) => prev.filter((m) => m.id !== id));

  const handleApprove = async (m: QueueMessage, withEdits = false) => {
    playPop();
    setBusyId(m.id);
    setErrors((e) => ({ ...e, [m.id]: [] }));
    const res = await approveMessage(m.id, withEdits ? draftEdits : undefined);
    setBusyId(null);
    if (res.ok) {
      playSuccess();
      confetti({ particleCount: 50, spread: 45, origin: { y: 0.8 }, colors: ["#6366f1", "#8b5cf6", "#d946ef"] });
      removeLocal(m.id);
      setEditingId(null);
      setApproved((n) => n + 1);
      flash(`✅ Approved reminder for ${m.invoices.customer_name}. It will send in the next allowed window.`);
      router.refresh();
    } else {
      setErrors((e) => ({ ...e, [m.id]: res.violations?.length ? res.violations : [res.error] }));
    }
  };

  const handleSkip = async (m: QueueMessage) => {
    setBusyId(m.id);
    const res = await skipMessage(m.id);
    setBusyId(null);
    if (res.ok) {
      removeLocal(m.id);
      flash(`Skipped draft for ${m.invoices.invoice_number}.`);
      router.refresh();
    } else {
      setErrors((e) => ({ ...e, [m.id]: [res.error] }));
    }
  };

  const handleApproveAll = () =>
    startTransition(async () => {
      const res = await approveAll();
      if (res.ok) {
        flash(`Approved ${res.approved} message(s)${res.failed ? `, ${res.failed} need edits` : ""}.`);
        setApproved((n) => n + res.approved);
        router.refresh();
      } else flash(res.error);
    });

  const handleRunAgent = () =>
    startTransition(async () => {
      const res = await runAgentNow();
      if (res.ok) {
        flash(
          res.drafted
            ? `✨ Agent drafted ${res.drafted} new reminder(s).`
            : "Agent checked every invoice — nothing is due right now."
        );
        router.refresh();
      } else flash(`Agent error: ${res.error}`);
    });

  const handleEnableAutopilot = () =>
    startTransition(async () => {
      const res = await setSendMode("autopilot", true);
      setShowAutopilotConfirm(false);
      if (res.ok) {
        setMode("autopilot");
        flash("Autopilot is ON. The agent will send on schedule without asking.");
      } else flash(res.error);
    });

  const handleDisableAutopilot = () =>
    startTransition(async () => {
      const res = await setSendMode("approval");
      if (res.ok) {
        setMode("approval");
        flash("Back to Approval mode. Nothing sends without your OK.");
      } else flash(res.error);
    });

  const autopilotUnlocked = approved >= AUTOPILOT_MIN;
  const fmt = (n: number, c?: string | null) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(Number(n));

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.15 }}
            className="fixed top-5 right-5 z-50 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">Approval Queue</h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            The agent drafts every reminder. Nothing is sent until you approve it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleRunAgent}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Run agent now
          </button>
          <button
            onClick={handleApproveAll}
            disabled={isPending || messages.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition disabled:opacity-40"
          >
            <CheckCheck className="w-4 h-4" />
            Approve all ({messages.length})
          </button>
        </div>
      </div>

      {/* Status strip: mode + model + autopilot progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Send mode</div>
          <div className="mt-1 flex items-center gap-2 text-lg font-black text-slate-950">
            {mode === "autopilot" ? <Unlock className="w-5 h-5 text-indigo-600" /> : <Lock className="w-5 h-5 text-emerald-600" />}
            {mode === "autopilot" ? "Autopilot" : "Approval required"}
          </div>
          {mode === "autopilot" ? (
            <button onClick={handleDisableAutopilot} className="mt-2 text-xs font-bold text-slate-700 underline">
              Switch back to Approval mode
            </button>
          ) : (
            <p className="mt-1 text-xs text-slate-600 font-medium">Safest setting. You review every email.</p>
          )}
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Autopilot unlock</div>
          <div className="mt-1 text-lg font-black text-slate-950">
            {Math.min(approved, AUTOPILOT_MIN)} / {AUTOPILOT_MIN} approvals
          </div>
          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
              initial={false}
              animate={{ width: `${Math.min(100, (approved / AUTOPILOT_MIN) * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {mode !== "autopilot" && (
            <button
              disabled={!autopilotUnlocked}
              onClick={() => setShowAutopilotConfirm(true)}
              className="mt-2 text-xs font-bold text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {autopilotUnlocked ? "Turn on Autopilot →" : "Approve a few more to unlock"}
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Writing engine</div>
          <div className="mt-2 text-sm font-mono font-semibold text-slate-800 flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-3 w-fit">
            <Zap className="w-4 h-4 text-amber-500" /> {modelLabel}
          </div>
          <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">Every draft is checked by code-level guardrails before hitting your queue.</p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
          Couldn&apos;t load the queue: {loadError}. If this mentions a missing table or column, run
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded">supabase/migrations/20261009000000_phase3.sql</code>
          in the Supabase SQL Editor.
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !loadError && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-300 rounded-2xl p-12 text-center shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-950">You&apos;re all caught up</h3>
          <p className="text-sm text-slate-600 font-medium mt-1 max-w-md mx-auto">
            No drafts are waiting. Click <strong>Run agent now</strong> to check which invoices need a reminder today,
            or use <strong>Draft AI</strong> on any invoice from the dashboard.
          </p>
        </motion.div>
      )}

      {/* Draft cards */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isEditing = editingId === m.id;
            const busy = busyId === m.id;
            const errs = errors[m.id] ?? [];
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                transition={{ duration: 0.18 }}
                className="bg-white border border-slate-300 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card header */}
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                      {m.invoices.customer_name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">{m.invoices.customer_name}</div>
                      <div className="text-xs text-slate-600 font-medium">
                        {m.invoices.invoice_number} · {fmt(m.invoices.amount, m.invoices.currency)} · due {m.invoices.due_date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                      {m.step}
                    </span>
                    {m.tone && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-800">
                        {m.tone}
                      </span>
                    )}
                    {m.guardrail_flagged ? (
                      <span
                        title={(m.violations ?? []).join("\n")}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> AI blocked · safe template used
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Guardrails passed
                      </span>
                    )}
                  </div>
                </div>

                {/* Email preview / editor */}
                <div className="p-5 space-y-3">
                  <div className="text-xs text-slate-600 font-medium">
                    To: <span className="font-bold text-slate-900">{m.invoices.customer_email}</span>
                  </div>
                  {isEditing ? (
                    <>
                      <input
                        value={draftEdits.subject}
                        onChange={(e) => setDraftEdits((d) => ({ ...d, subject: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <textarea
                        value={draftEdits.body}
                        onChange={(e) => setDraftEdits((d) => ({ ...d, body: e.target.value }))}
                        rows={9}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="text-[11px] text-slate-500 font-medium">
                        {draftEdits.body.trim().split(/\s+/).filter(Boolean).length} words · your edits are re-checked by the guardrails before approval
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-black text-slate-950">{m.subject}</div>
                      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-200 rounded-xl p-4">
                        {m.body}
                      </div>
                    </>
                  )}

                  <AnimatePresence>
                    {errs.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold space-y-1"
                      >
                        {errs.map((er, i) => (
                          <div key={i}>• {er}</div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => handleSkip(m)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Skip
                  </button>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 active:scale-95 transition"
                      >
                        Cancel edit
                      </button>
                      <button
                        onClick={() => handleApprove(m, true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Save & approve
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setDraftEdits({ subject: m.subject, body: m.body });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleApprove(m)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm active:scale-95 transition disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Autopilot confirmation modal */}
      <AnimatePresence>
        {showAutopilotConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAutopilotConfirm(false)}
              className="fixed inset-0 bg-slate-950/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Unlock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Turn on Autopilot?</h3>
              <ul className="text-sm text-slate-700 font-medium space-y-1.5 list-disc pl-5">
                <li>The agent will send reminders on schedule <strong>without asking you first</strong>.</li>
                <li>Guardrails still block threats, invented amounts, and pressure tactics.</li>
                <li>Sends only Mon–Fri, 9am–5pm in the customer&apos;s timezone.</li>
                <li>Disputes, opt-outs, and paid invoices still stop all messages instantly.</li>
                <li>You can switch back to Approval mode at any time.</li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAutopilotConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-300 hover:bg-slate-50"
                >
                  Keep approving manually
                </button>
                <button
                  onClick={handleEnableAutopilot}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Yes, turn on Autopilot
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
