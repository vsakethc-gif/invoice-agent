"use client";

import { useActionState, useEffect, useState } from "react";
import { submitOnboarding } from "./actions";

const initialState = {
  error: "",
};

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await submitOnboarding(formData);
      if (result?.error) {
        return { error: result.error };
      }
      return prevState;
    },
    initialState
  );

  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow border border-slate-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            Welcome to InvoiceNudge
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Let's set up your business profile so we can start following up.
          </p>
        </div>
        <form className="mt-8 space-y-6" action={formAction}>
          {state?.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {state.error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Business Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Acme Design Co."
                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="owner_name" className="block text-sm font-medium text-slate-700">
                Your Full Name
              </label>
              <input
                id="owner_name"
                name="owner_name"
                type="text"
                required
                placeholder="Jane Doe"
                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="reply_to_email" className="block text-sm font-medium text-slate-700">
                Reply-To Email Address
              </label>
              <p className="text-xs text-slate-500 mb-1">When customers reply to reminders, it goes here.</p>
              <input
                id="reply_to_email"
                name="reply_to_email"
                type="email"
                required
                placeholder="jane@acmedesign.com"
                className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-slate-700">
                Timezone
              </label>
              <input
                id="timezone"
                name="timezone"
                type="text"
                required
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 bg-slate-50 rounded-md shadow-sm text-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="default_tone" className="block text-sm font-medium text-slate-700">
                Default Tone
              </label>
              <select
                id="default_tone"
                name="default_tone"
                defaultValue="Professional"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="Friendly">Friendly</option>
                <option value="Professional">Professional</option>
                <option value="Firm">Firm</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Go to Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
