"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function loadDemoInvoices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!business) return { error: "No business found" };

  const today = new Date();
  const formatDate = (daysOffset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
  };

  const sampleInvoices = [
    {
      business_id: business.id,
      invoice_number: "INV-2024-001 [DEMO]",
      customer_name: "Apex Consulting LLC",
      customer_email: "billing@apexconsulting.com",
      amount: 4500.00,
      currency: "USD",
      issue_date: formatDate(-45),
      due_date: formatDate(-15),
      status: "overdue",
      payment_link: "https://pay.stripe.com/demo1",
    },
    {
      business_id: business.id,
      invoice_number: "INV-2024-002 [DEMO]",
      customer_name: "BlueSky Logistics",
      customer_email: "ap@blueskylogistics.com",
      amount: 1850.00,
      currency: "USD",
      issue_date: formatDate(-20),
      due_date: formatDate(-2),
      status: "overdue",
      payment_link: "https://pay.stripe.com/demo2",
    },
    {
      business_id: business.id,
      invoice_number: "INV-2024-003 [DEMO]",
      customer_name: "Cascade Media Group",
      customer_email: "finance@cascademedia.com",
      amount: 6200.00,
      currency: "USD",
      issue_date: formatDate(-60),
      due_date: formatDate(-30),
      status: "overdue",
      payment_link: "https://pay.stripe.com/demo3",
    },
    {
      business_id: business.id,
      invoice_number: "INV-2024-004 [DEMO]",
      customer_name: "Redwood Design Studio",
      customer_email: "sarah@redwoodstudio.com",
      amount: 3200.00,
      currency: "USD",
      issue_date: formatDate(-30),
      due_date: formatDate(-5),
      status: "paid",
      payment_link: "https://pay.stripe.com/demo4",
    },
    {
      business_id: business.id,
      invoice_number: "INV-2024-005 [DEMO]",
      customer_name: "Horizon Health Tech",
      customer_email: "payments@horizonhealth.io",
      amount: 8900.00,
      currency: "USD",
      issue_date: formatDate(-10),
      due_date: formatDate(10),
      status: "upcoming",
      payment_link: "https://pay.stripe.com/demo5",
    },
    {
      business_id: business.id,
      invoice_number: "INV-2024-006 [DEMO]",
      customer_name: "Summit Ridge Partners",
      customer_email: "david@summitridge.com",
      amount: 2750.00,
      currency: "USD",
      issue_date: formatDate(-18),
      due_date: formatDate(-4),
      status: "disputed",
      payment_link: "https://pay.stripe.com/demo6",
    },
  ];

  const { error } = await supabase.from("invoices").insert(sampleInvoices);

  if (error) {
    console.error("DEMO INVOICES INSERT ERROR:", error);
    return { error: error.message };
  }

  // Update total recovered
  await supabase
    .from("businesses")
    .update({ total_recovered: 3200.00 })
    .eq("id", business.id);

  revalidatePath("/dashboard");
  return { success: true };
}
