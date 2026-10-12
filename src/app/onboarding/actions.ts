"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "User not found" };
  }

  const name = formData.get("name") as string;
  const owner_name = formData.get("owner_name") as string;
  const reply_to_email = formData.get("reply_to_email") as string;
  const timezone = formData.get("timezone") as string;
  const default_tone = formData.get("default_tone") as string;

  const { error } = await supabase.from("businesses").insert({
    user_id: user.id,
    name,
    owner_name,
    reply_to_email,
    timezone,
    default_tone,
    send_mode: "approval", // Default
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
