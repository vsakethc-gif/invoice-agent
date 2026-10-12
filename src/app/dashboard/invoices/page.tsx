import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

export const instant = false;

export default async function InvoicesPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!business) return null;

  const { data: invoices = [] } = await supabase
    .from("invoices")
    .select("*")
    .eq("business_id", business.id)
    .order("due_date", { ascending: false });

  const invoiceList = invoices || [];
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">Track and manage all customer invoices and follow-ups</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/invoices/upload"
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </Link>
          <Link
            href="/dashboard/invoices/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Invoice
          </Link>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        {invoiceList.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No invoices found. Click "Add Invoice" or "Upload CSV" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 px-6 text-left font-semibold text-slate-700">Invoice #</th>
                  <th className="py-3 px-6 text-left font-semibold text-slate-700">Customer</th>
                  <th className="py-3 px-6 text-left font-semibold text-slate-700">Amount</th>
                  <th className="py-3 px-6 text-left font-semibold text-slate-700">Due Date</th>
                  <th className="py-3 px-6 text-left font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceList.map((inv: any) => {
                  const isPastDue = inv.due_date < todayStr && inv.status !== "paid";
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-6 font-medium text-slate-900">{inv.invoice_number}</td>
                      <td className="py-3.5 px-6">
                        <div className="font-medium text-slate-900">{inv.customer_name}</div>
                        <div className="text-xs text-slate-400">{inv.customer_email}</div>
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        ${Number(inv.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={isPastDue ? "text-rose-600 font-medium" : "text-slate-600"}>
                          {inv.due_date}
                        </span>
                        {isPastDue && <span className="ml-1.5 text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Overdue</span>}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
