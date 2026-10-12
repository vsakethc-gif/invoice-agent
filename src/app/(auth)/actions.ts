"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.log("LOGIN ERROR:", error);
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  if (error) {
    console.log("SIGNUP ERROR:", error);
    return { error: error.message };
  }

  if (signUpData.session === null && signUpData.user !== null) {
    const { error: signInError } = await supabase.auth.signInWithPassword(data);
    if (signInError) {
      return { error: "Please check your email to confirm your account, or disable 'Confirm email' in Supabase Auth settings." };
    }
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
