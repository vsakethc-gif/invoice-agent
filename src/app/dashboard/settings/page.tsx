import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const instant = false;

export default async function SettingsPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user?.id)
    .single();

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Settings</h2>
        <p className="text-base text-slate-500 mt-2">Configure your business profile, sending preferences, and compliance details.</p>
      </div>

      <SettingsForm business={business} />
    </div>
  );
}
