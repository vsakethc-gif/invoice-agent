import { connection } from "next/server";

export const instant = false;

export default async function NeedsAttentionPage() {
  await connection();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Needs Attention</h2>
        <p className="text-sm text-slate-500">Invoices that require owner review (disputes, final notices, or customer questions).</p>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-10 text-center text-slate-500">
        All clear! No invoices currently require manual intervention.
      </div>
    </div>
  );
}
