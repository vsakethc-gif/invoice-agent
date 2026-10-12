'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const updates = {
    name: formData.get("name") as string,
    owner_name: formData.get("owner_name") as string,
    reply_to_email: formData.get("reply_to_email") as string,
    timezone: formData.get("timezone") as string,
    default_tone: formData.get("default_tone") as string,
    send_mode: formData.get("send_mode") as string,
    mailing_address: formData.get("mailing_address") as string,
    default_payment_link: formData.get("default_payment_link") as string,
    grace_period_days: parseInt(formData.get("grace_period_days") as string) || 0,
    minimum_chase_amount: parseFloat(formData.get("minimum_chase_amount") as string) || 0,
    bcc_email: formData.get("bcc_email") as string,
    skip_weekends: formData.get("skip_weekends") === "on",
    theme_color: formData.get("theme_color") as string,
    ui_density: formData.get("ui_density") as string,
    escalation_speed: formData.get("escalation_speed") as string,
    agent_language: formData.get("agent_language") as string,
    late_fee_percentage: parseFloat(formData.get("late_fee_percentage") as string) || 0,
  };

  const { error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to update settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
