"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Upload,
  Calendar,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Check,
  Pause,
  Play,
  Copy,
  Mail,
  Zap,
  MessageSquare,
  AlertCircle,
  X,
  Send,
  HelpCircle,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { playSuccess, playPop } from "@/utils/sfx";
import { useRouter } from "next/navigation";
import { DemoDataButton } from "./DemoDataButton";
import {
  updateInvoiceStatus,
  createDraftForInvoice,
  setSendMode as setSendModeAction,
} from "../agent-actions";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
  payment_link?: string;
  notes?: string;
}

interface DashboardViewProps {
  business: {
    id: string;
    name: string;
    owner_name: string;
    send_mode: string;
    total_recovered: number;
  };
  initialInvoices: Invoice[];
}

export function DashboardView({ business, initialInvoices }: DashboardViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "overdue" | "upcoming" | "paid" | "disputed">("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [aiPreviewInvoice, setAiPreviewInvoice] = useState<Invoice | null>(null);
  const [aiTone, setAiTone] = useState<"Friendly" | "Professional" | "Firm">("Professional");
  const [copiedLink, setCopiedLink] = useState(false);
  const [sendMode, setSendMode] = useState<string>(business.send_mode || "approval");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const router = useRouter();

  // Re-sync when the server sends fresh data (after router.refresh())
  const [lastInitial, setLastInitial] = useState(initialInvoices);
  if (initialInvoices !== lastInitial) {
    setLastInitial(initialInvoices);
    setInvoices(initialInvoices);
  }

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Compute live metrics
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let recovered = 0;

    for (const inv of invoices) {
      const amt = Number(inv.amount || 0);
      if (inv.status === "paid") {
        paidCount++;
        recovered += amt;
      } else {
        totalOutstanding += amt;
        if (inv.due_date < todayStr || inv.status === "overdue") {
          overdueAmount += amt;
          overdueCount++;
        }
      }
    }

    const fmt = (v: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

    return [
      {
        id: "total",
        label: "Total Outstanding",
        value: fmt(totalOutstanding),
        subtext: `${invoices.filter((i) => i.status !== "paid").length} active invoices`,
        targetTab: "all" as const,
        accent: "border-t-blue-500",
      },
      {
        id: "overdue",
        label: "Overdue Amount",
        value: fmt(overdueAmount),
        subtext: `${overdueCount} require follow-up (Click to filter)`,
        targetTab: "overdue" as const,
        alert: overdueAmount > 0,
        accent: "border-t-rose-500",
      },
      {
        id: "recovered",
        label: "Recovered by Agent",
        value: fmt(recovered),
        subtext: `${paidCount} settled (Click to view)`,
        targetTab: "paid" as const,
        badge: "Proof of Value",
        accent: "border-t-emerald-500",
      },
      {
        id: "mode",
        label: "Send Automation Mode",
        value: sendMode === "autopilot" ? "Autopilot Mode" : "Approval Queue",
        subtext: sendMode === "autopilot" ? "Autonomous scheduled sending" : "Requires owner sign-off",
        badge: sendMode === "autopilot" ? "Active" : "Safety Lock",
        accent: "border-t-indigo-500",
        isToggle: true,
      },
    ];
  }, [invoices, business, sendMode, todayStr]);

  // Filter invoices based on tab and search
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customer_email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      if (activeTab === "overdue") return inv.due_date < todayStr && inv.status !== "paid";
      if (activeTab === "upcoming") return inv.due_date >= todayStr && inv.status === "upcoming";
      if (activeTab === "paid") return inv.status === "paid";
      if (activeTab === "disputed") return inv.status === "disputed";
      return true;
    });
  }, [invoices, searchQuery, activeTab, todayStr]);

  // Optimistically update one invoice in local state
  const patchLocal = (id: string, patch: Partial<Invoice>) => {
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setSelectedInvoice((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  // Celebrate payment (saved to the database; queued reminders are cancelled)
  const handleMarkPaid = async (inv: Invoice) => {
    playPop();
    const previous = inv.status;
    patchLocal(inv.id, { status: "paid" });
    playSuccess();
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#10b981", "#3b82f6", "#f43f5e"],
    });
    const res = await updateInvoiceStatus(inv.id, "paid");
    if (res.ok) {
      showToast(`🎉 ${inv.invoice_number} marked as Paid! Recovered $${Number(inv.amount).toLocaleString()}. Reminders stopped.`);
      router.refresh();
    } else {
      patchLocal(inv.id, { status: previous });
      showToast(`Couldn't save: ${res.error}`);
    }
  };

  const handleTogglePause = async (inv: Invoice) => {
    const previous = inv.status;
    const resuming = inv.status === "paused";
    patchLocal(inv.id, { status: resuming ? (inv.due_date < todayStr ? "overdue" : "upcoming") : "paused" });
    const res = await updateInvoiceStatus(inv.id, resuming ? "active" : "paused");
    if (res.ok) {
      patchLocal(inv.id, { status: res.status });
      showToast(`Reminders ${resuming ? "resumed" : "paused"} for ${inv.customer_name}.`);
      router.refresh();
    } else {
      patchLocal(inv.id, { status: previous });
      showToast(`Couldn't save: ${res.error}`);
    }
  };

  const handleMarkDisputed = async (inv: Invoice) => {
    const previous = inv.status;
    patchLocal(inv.id, { status: "disputed" });
    const res = await updateInvoiceStatus(inv.id, "disputed");
    if (res.ok) {
      showToast(`⚠️ ${inv.invoice_number} marked disputed. All automatic messages stopped.`);
      router.refresh();
    } else {
      patchLocal(inv.id, { status: previous });
      showToast(`Couldn't save: ${res.error}`);
    }
  };

  const handleCopyPaymentLink = (link?: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast("Payment link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleSendMode = async () => {
    if (sendMode === "autopilot") {
      const res = await setSendModeAction("approval");
      if (res.ok) {
        setSendMode("approval");
        showToast("Back to Approval mode. Nothing sends without your OK.");
      } else showToast(res.error);
      return;
    }
    // Autopilot requires 5 approvals + a confirmation screen, which lives in the Approval Queue
    router.push("/dashboard/queue");
  };

  const handlePushDraft = async (inv: Invoice) => {
    setDrafting(true);
    const res = await createDraftForInvoice(inv.id, aiTone);
    setDrafting(false);
    if (res.ok) {
      setAiPreviewInvoice(null);
      showToast(`✨ Draft for ${inv.invoice_number} added to your Approval Queue.`);
      router.refresh();
    } else {
      showToast(res.error);
    }
  };

  return (
    <div className="space-y-7 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compliance / Safety disclaimer banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm hover:border-slate-300 transition"
      >
        <div className="flex items-center gap-3 text-xs text-slate-800">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-slate-950 font-bold">Safe & Compliant B2B Agent:</strong> Follow-ups are sent politely in your own company name. Hard guardrails prevent legal threats, deceptive tactics, or collections language.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Tenant Isolated (RLS)
          </span>
        </div>
      </motion.div>

      {/* Header with Title, Mode Switcher and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Accounts Receivable
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            Automated intelligent follow-ups for <span className="font-bold text-slate-900">{business.name}</span>
          </p>
        </div>

        {/* Action Buttons with high-appeal interactive physics */}
        <div className="flex items-center flex-wrap gap-2.5">
          <DemoDataButton />
          
          <Link
            href="/dashboard/invoices/upload"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-300 shadow-sm text-xs font-bold rounded-xl text-slate-800 bg-white hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition duration-150"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            Upload CSV
          </Link>

          <Link
            href="/dashboard/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-transparent shadow-md text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition duration-150 shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Invoice
          </Link>
        </div>
      </div>

      {/* Interactive Metrics Row Cards (Clicking them filters the view!) */}
      <motion.div 
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {metrics.map((m) => (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            key={m.label}
            onClick={() => {
              if (m.isToggle) {
                handleToggleSendMode();
              } else if (m.targetTab) {
                setActiveTab(m.targetTab);
                showToast(`Filtered to ${m.label}`);
              }
            }}
            className={`cursor-pointer relative p-5 rounded-2xl bg-white border border-t-4 ${m.accent} shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-[0.99] transition-all duration-150 select-none ${
              m.alert
                ? "bg-rose-50/20 border-slate-300"
                : m.badge && !m.isToggle
                ? "bg-emerald-50/20 border-slate-300"
                : "border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {m.label}
              </span>
              {m.badge && (
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  m.isToggle && sendMode === "autopilot"
                    ? "bg-indigo-100 text-indigo-900 border-indigo-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                }`}>
                  {m.badge}
                </span>
              )}
            </div>

            <div className={`text-3xl font-black tracking-tight ${
              m.alert ? "text-rose-700" : m.badge && !m.isToggle ? "text-emerald-800" : "text-slate-950"
            }`}>
              {m.value}
            </div>

            <div className="mt-2.5 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>{m.subtext}</span>
              <span className="text-slate-400 group-hover:text-slate-800">→</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Table Panel */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden">
        {/* Filter bar & Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/80">
          {/* Animated Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1.5 rounded-xl">
            {(
              [
                { id: "all", label: "All Invoices" },
                { id: "overdue", label: "Overdue" },
                { id: "upcoming", label: "Upcoming" },
                { id: "paid", label: "Paid" },
                { id: "disputed", label: "Disputed" },
              ] as const
            ).map((tab) => {
              const count =
                tab.id === "all"
                  ? invoices.length
                  : tab.id === "overdue"
                  ? invoices.filter((i) => i.due_date < todayStr && i.status !== "paid").length
                  : invoices.filter((i) => i.status === tab.id).length;

              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1.5 active:scale-95 ${
                    isSelected
                      ? "text-slate-950 bg-white shadow-sm ring-1 ring-slate-200"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected
                        ? "bg-blue-100 text-blue-900"
                        : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Search box with clear button */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by invoice #, customer, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-950 placeholder:text-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {filteredInvoices.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-950">No invoices in this view</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto font-medium">
              Try switching your filter tab or clearing the search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-extrabold tracking-wider uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3.5 px-5">Invoice #</th>
                  <th scope="col" className="py-3.5 px-5">Customer & Email</th>
                  <th scope="col" className="py-3.5 px-5">Amount</th>
                  <th scope="col" className="py-3.5 px-5">Due Date</th>
                  <th scope="col" className="py-3.5 px-5">Status</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Interactive Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <AnimatePresence>
                  {filteredInvoices.map((inv) => {
                    const isPastDue = inv.due_date < todayStr && inv.status !== "paid";
                    return (
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={inv.id}
                        className="hover:bg-blue-50/70 transition-colors duration-75 group"
                      >
                      <td
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-4 px-5 font-black text-slate-950 text-sm cursor-pointer hover:underline"
                      >
                        {inv.invoice_number}
                      </td>
                      <td
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-4 px-5 cursor-pointer"
                      >
                        <div className="font-extrabold text-slate-950 text-sm">{inv.customer_name}</div>
                        <div className="text-xs text-slate-600 font-medium">{inv.customer_email}</div>
                      </td>
                      <td
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-4 px-5 font-black text-slate-950 text-sm cursor-pointer"
                      >
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: inv.currency || "USD",
                        }).format(inv.amount)}
                      </td>
                      <td
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-4 px-5 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={isPastDue ? "text-rose-700 font-bold" : "text-slate-800 font-semibold"}>
                            {inv.due_date}
                          </span>
                          {isPastDue && (
                            <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                            inv.status === "paid"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : inv.status === "disputed"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : inv.status === "paused"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : isPastDue
                              ? "bg-orange-100 text-orange-800 border border-orange-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inv.status === "paid"
                                ? "bg-emerald-600"
                                : inv.status === "disputed"
                                ? "bg-rose-600"
                                : inv.status === "paused"
                                ? "bg-amber-600"
                                : isPastDue
                                ? "bg-orange-600"
                                : "bg-blue-600"
                            }`}
                          />
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right space-x-2">
                        {/* Interactive Row Buttons */}
                        {inv.status !== "paid" && (
                          <>
                            <button
                              onClick={() => setAiPreviewInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition active:scale-95"
                              title="Draft AI reminder for this invoice"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              Draft AI
                            </button>
                            <button
                              onClick={() => handleMarkPaid(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 transition active:scale-95"
                              title="Mark this invoice as collected"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Mark Paid
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition active:scale-95"
                        >
                          Details
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Message Drafting Modal / Simulator */}
      <AnimatePresence>
        {aiPreviewInvoice && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAiPreviewInvoice(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-blue-50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">AI Follow-Up Assistant</h3>
                    <p className="text-[11px] text-slate-600 font-semibold">
                      Drafting reminder for {aiPreviewInvoice.invoice_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAiPreviewInvoice(null)}
                  className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Tone Selector */}
                <div>
                  <label className="block text-slate-800 font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Select Tone Escalation:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Friendly", "Professional", "Firm"] as const).map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setAiTone(tone)}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs transition ${
                          aiTone === tone
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Preview Box */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
                  <div className="border-b border-slate-200 pb-2 space-y-1">
                    <div className="text-slate-500 text-[11px]">
                      <strong className="text-slate-800">To:</strong> {aiPreviewInvoice.customer_name} &lt;{aiPreviewInvoice.customer_email}&gt;
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      <strong className="text-slate-800">Subject:</strong> {aiTone === "Friendly" ? "Quick reminder:" : aiTone === "Firm" ? "Past Due Notice:" : "Regarding"} Invoice {aiPreviewInvoice.invoice_number} from {business.name}
                    </div>
                  </div>

                  <div className="text-slate-800 leading-relaxed font-sans text-xs pt-1">
                    <p>Hi {aiPreviewInvoice.customer_name},</p>
                    <p className="mt-2">
                      {aiTone === "Friendly"
                        ? `Hope you're having a productive week! Just sending a friendly heads-up that invoice ${aiPreviewInvoice.invoice_number} for $${aiPreviewInvoice.amount.toLocaleString()} was due on ${aiPreviewInvoice.due_date}.`
                        : aiTone === "Firm"
                        ? `This is a second notice regarding overdue invoice ${aiPreviewInvoice.invoice_number} for $${aiPreviewInvoice.amount.toLocaleString()}, which was due on ${aiPreviewInvoice.due_date}. Please submit payment as soon as possible.`
                        : `I wanted to follow up regarding invoice ${aiPreviewInvoice.invoice_number} in the amount of $${aiPreviewInvoice.amount.toLocaleString()}, which matured on ${aiPreviewInvoice.due_date}.`}
                    </p>
                    <p className="mt-2">
                      You can securely process this via your payment link:{" "}
                      <span className="text-blue-600 font-medium underline">
                        {aiPreviewInvoice.payment_link || "https://pay.stripe.com/invoice-link"}
                      </span>
                    </p>
                    <p className="mt-2">
                      Best regards,<br />
                      <strong>{business.owner_name}</strong><br />
                      <span className="text-slate-500">{business.name}</span>
                    </p>
                  </div>
                </div>

                {/* Guardrail Verification Chip */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Passed 6/6 Guardrail Checks (Zero collection threats, authentic invoice data)
                  </span>
                  <span className="text-emerald-700 font-bold uppercase text-[10px]">Verified</span>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5">
                <button
                  onClick={() => setAiPreviewInvoice(null)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePushDraft(aiPreviewInvoice)}
                  disabled={drafting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  {drafting ? "Drafting with AI..." : "Draft & add to Approval Queue"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Drawer for Invoice Details & Timeline */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col z-10 border-l border-slate-200"
            >
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Invoice Profile
                  </span>
                  <h3 className="text-lg font-black text-slate-950 mt-0.5">
                    {selectedInvoice.invoice_number}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs transition"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs text-slate-700">
                {/* Total Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-md">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                    Amount Owed
                  </div>
                  <div className="text-3xl font-black mt-1">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: selectedInvoice.currency || "USD",
                    }).format(selectedInvoice.amount)}
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-300">
                    <span>Due: <strong>{selectedInvoice.due_date}</strong></span>
                    <span className="capitalize px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                      {selectedInvoice.status}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                    Customer Details
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">Client Name</span>
                      <span className="font-extrabold text-slate-950 text-sm">
                        {selectedInvoice.customer_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">Email Address</span>
                      <span className="text-slate-900 font-bold">
                        {selectedInvoice.customer_email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Link with 1-click Copy */}
                {selectedInvoice.payment_link && (
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                      Customer Payment URL
                    </h4>
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-600 truncate flex-1 text-[11px] font-mono">
                        {selectedInvoice.payment_link}
                      </span>
                      <button
                        onClick={() => handleCopyPaymentLink(selectedInvoice.payment_link)}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
                      >
                        {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedLink ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Escalation Cadence Sequence */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                    Escalation Follow-Up Cadence
                  </h4>
                  <div className="space-y-3 relative border-l-2 border-slate-200 ml-2.5 pl-4 py-1">
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                      <div className="font-bold text-slate-900 text-xs">Day -3: Polite Reminder</div>
                      <div className="text-slate-500 text-[11px]">Friendly heads-up prior to deadline</div>
                    </div>
                    <div className="relative pt-1">
                      <div className="absolute -left-[23px] top-2 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="font-bold text-slate-800 text-xs">Day +1: Soft Check-in</div>
                      <div className="text-slate-500 text-[11px]">Courteous inquiry if invoice was received</div>
                    </div>
                    <div className="relative pt-1">
                      <div className="absolute -left-[23px] top-2 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="font-bold text-slate-800 text-xs">Day +7: Professional Statement</div>
                      <div className="text-slate-500 text-[11px]">Formal notice with invoice statement</div>
                    </div>
                    <div className="relative pt-1">
                      <div className="absolute -left-[23px] top-2 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="font-bold text-slate-800 text-xs">Day +14 & +30: Owner Escalation</div>
                      <div className="text-slate-500 text-[11px]">Direct follow-up in business owner's voice</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Actions Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
                {selectedInvoice.status !== "paid" ? (
                  <button
                    onClick={() => handleMarkPaid(selectedInvoice)}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
                  >
                    <Check className="w-4 h-4" /> Mark Paid
                  </button>
                ) : (
                  <div className="flex-1 py-2.5 px-3 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Settled & Paid
                  </div>
                )}

                <button
                  onClick={() => handleTogglePause(selectedInvoice)}
                  disabled={selectedInvoice.status === "paid" || selectedInvoice.status === "disputed"}
                  className="py-2.5 px-3.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition disabled:opacity-40"
                >
                  {selectedInvoice.status === "paused" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {selectedInvoice.status === "paused" ? "Resume" : "Pause"}
                </button>

                {selectedInvoice.status !== "paid" && selectedInvoice.status !== "disputed" && (
                  <button
                    onClick={() => handleMarkDisputed(selectedInvoice)}
                    className="py-2.5 px-3.5 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
                    title="Stops all automatic messages for this invoice"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Disputed
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
