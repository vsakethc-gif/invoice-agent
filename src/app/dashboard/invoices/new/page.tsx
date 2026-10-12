"use client";

import { useActionState } from "react";
import { createInvoice } from "../actions";

export default function NewInvoicePage() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await createInvoice(formData);
      if (result?.error) {
        return { error: result.error };
      }
      return prevState;
    },
    { error: "" }
  );

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Add Manual Invoice</h2>
      <form action={formAction} className="space-y-6">
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {state.error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Invoice Number</label>
            <input name="invoice_number" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Amount ($)</label>
            <input name="amount" type="number" step="0.01" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Customer Name</label>
            <input name="customer_name" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Customer Email</label>
            <input name="customer_email" type="email" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Issue Date</label>
            <input name="issue_date" type="date" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Due Date</label>
            <input name="due_date" type="date" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
        </div>

        <button type="submit" disabled={isPending} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {isPending ? "Saving..." : "Save Invoice"}
        </button>
      </form>
    </div>
  );
}
