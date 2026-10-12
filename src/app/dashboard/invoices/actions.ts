"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function createInvoice(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!business) return { error: "No business found" };

  const invoice = {
    business_id: business.id,
    invoice_number: formData.get("invoice_number") as string,
    customer_name: formData.get("customer_name") as string,
    customer_email: formData.get("customer_email") as string,
    amount: parseFloat(formData.get("amount") as string),
    issue_date: formData.get("issue_date") as string,
    due_date: formData.get("due_date") as string,
    status: (formData.get("due_date") as string) < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming",
  };

  console.log("Attempting to insert invoice for business:", business.id);
  const { data: insertedData, error } = await supabase.from("invoices").insert(invoice).select();

  if (error) {
    console.error("CREATE INVOICE ERROR:", error);
    return { error: error.message };
  }

  console.log("INVOICE CREATED SUCCESSFULLY:", insertedData);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function uploadInvoices(invoices: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!business) return { error: "No business found" };

  const formattedInvoices = invoices.map((inv) => ({
    business_id: business.id,
    invoice_number: inv.invoice_number,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    amount: parseFloat(inv.amount),
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    status: inv.due_date < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming",
  }));

  const { error } = await supabase.from("invoices").insert(formattedInvoices);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
