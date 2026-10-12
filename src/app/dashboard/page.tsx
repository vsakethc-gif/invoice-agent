import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { DashboardView } from "./components/DashboardView";

export const instant = false;

export default async function DashboardPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch business stats
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!business) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-lg mx-auto mt-16 space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Finish Your Business Profile</h3>
        <p className="text-sm text-slate-500">
          You need to configure your business profile and sender settings before we can start tracking invoices.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
        >
          Complete Onboarding
        </Link>
      </div>
    );
  }

  // Fetch all invoices for this business ordered by due date
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("business_id", business.id)
    .order("due_date", { ascending: false });

  if (invError) {
    console.error("DASHBOARD FETCH INVOICES ERROR:", invError);
  }

  return (
    <DashboardView
      business={business}
      initialInvoices={invoices || []}
    />
  );
}
