"use client";

import { useState, useTransition } from 'react';
import { updateSettings } from './actions';
import { 
  Save, Loader2, CheckCircle2, Building2, User, Globe2, 
  Bot, Languages, Gauge, Sparkles, SlidersHorizontal, 
  Mail, CalendarOff, Wallet, Palette, Monitor
} from 'lucide-react';
import { motion } from 'framer-motion';

export function SettingsForm({ business }: { business: any }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "agent" | "automation" | "appearance">("profile");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSettings(formData);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert("Failed to save: " + res.error);
      }
    });
  };

  const tabs = [
    { id: "profile", label: "Business Profile", icon: Building2 },
    { id: "agent", label: "AI Persona", icon: Bot },
    { id: "automation", label: "Automation Rules", icon: SlidersHorizontal },
    { id: "appearance", label: "Appearance", icon: Palette },
  ] as const;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 space-y-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${
                isActive ? "text-indigo-700 bg-indigo-50/80 shadow-sm border border-indigo-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              {tab.label}
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full" 
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Form Content Area */}
      <form onSubmit={handleSubmit} className="flex-1 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden min-h-[500px] flex flex-col">
        <div className="flex-1 space-y-8 relative">
            
          {/* TAB: PROFILE */}
          <div className={`space-y-6 transition-opacity duration-300 ${activeTab === "profile" ? "opacity-100 block" : "opacity-0 hidden"}`}>
            <div>
              <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" /> Business Profile
              </h3>
              <p className="text-sm text-slate-500 mt-1">This information is used to sign off your emails and comply with anti-spam laws.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400"/> Company Name</label>
                <input type="text" name="name" defaultValue={business?.name || ''} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><User className="w-4 h-4 text-slate-400"/> Your Name</label>
                <input type="text" name="owner_name" defaultValue={business?.owner_name || ''} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400"/> Reply-To Email</label>
                <input type="email" name="reply_to_email" defaultValue={business?.reply_to_email || ''} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Globe2 className="w-4 h-4 text-slate-400"/> Timezone</label>
                <select name="timezone" defaultValue={business?.timezone || 'America/New_York'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition">
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mailing Address (Required for CAN-SPAM)</label>
              <textarea name="mailing_address" defaultValue={business?.mailing_address || ''} rows={2} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition resize-none" />
            </div>
          </div>

          {/* TAB: AGENT PERSONA */}
          <div className={`space-y-6 transition-opacity duration-300 ${activeTab === "agent" ? "opacity-100 block" : "opacity-0 hidden"}`}>
            <div>
              <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-500" /> AI Persona
              </h3>
              <p className="text-sm text-slate-500 mt-1">Control how the AI speaks to your clients.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Sparkles className="w-4 h-4 text-slate-400"/> Default Tone</label>
                <select name="default_tone" defaultValue={business?.default_tone || 'Professional'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition">
                  <option value="Friendly">Friendly</option>
                  <option value="Professional">Professional</option>
                  <option value="Firm">Firm</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Languages className="w-4 h-4 text-slate-400"/> Agent Language</label>
                <select name="agent_language" defaultValue={business?.agent_language || 'English'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition">
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Gauge className="w-4 h-4 text-slate-400"/> Escalation Speed</label>
                <select name="escalation_speed" defaultValue={business?.escalation_speed || 'normal'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition">
                  <option value="lenient">Lenient (Slower to get firm)</option>
                  <option value="normal">Normal (Standard)</option>
                  <option value="aggressive">Aggressive (Gets firm quickly)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-slate-400"/> Late Fee Policy (%)</label>
                <input type="number" name="late_fee_percentage" min="0" step="0.1" defaultValue={business?.late_fee_percentage || 0} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition" />
                <p className="text-xs text-slate-500 mt-1">If set, AI may warn clients about this fee on Day +14.</p>
              </div>
            </div>
          </div>

          {/* TAB: AUTOMATION */}
          <div className={`space-y-6 transition-opacity duration-300 ${activeTab === "automation" ? "opacity-100 block" : "opacity-0 hidden"}`}>
            <div>
              <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-500" /> Automation Rules
              </h3>
              <p className="text-sm text-slate-500 mt-1">Configure exactly when and how emails go out.</p>
            </div>

            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-indigo-950">Send Mode</h4>
                <p className="text-xs text-indigo-700 mt-1">Autopilot requires 5 prior approvals to activate safely.</p>
              </div>
              <select name="send_mode" defaultValue={business?.send_mode || 'approval'} className="p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="approval">Approval Required</option>
                <option value="autopilot">Autopilot</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Grace Period (Days)</label>
                <input type="number" name="grace_period_days" min="0" defaultValue={business?.grace_period_days || 0} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white transition" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Min. Chase Amount ($)</label>
                <input type="number" name="minimum_chase_amount" min="0" step="0.01" defaultValue={business?.minimum_chase_amount || 0} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white transition" />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition group">
              <input type="checkbox" name="skip_weekends" defaultChecked={business?.skip_weekends ?? true} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" />
              <div>
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><CalendarOff className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" /> Weekend Protection</div>
                <div className="text-xs text-slate-500 mt-0.5">Automatically pause all sending on Saturdays and Sundays.</div>
              </div>
            </label>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">BCC Email (Optional)</label>
              <input type="email" name="bcc_email" defaultValue={business?.bcc_email || ''} placeholder="you@company.com" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white transition" />
            </div>
          </div>

          {/* TAB: APPEARANCE */}
          <div className={`space-y-6 transition-opacity duration-300 ${activeTab === "appearance" ? "opacity-100 block" : "opacity-0 hidden"}`}>
            <div>
              <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-500" /> App Appearance
              </h3>
              <p className="text-sm text-slate-500 mt-1">Personalize how InvoiceNudge looks and feels for you.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Palette className="w-4 h-4 text-slate-400"/> Accent Color</label>
                <div className="flex gap-3">
                  {["indigo", "blue", "emerald", "rose"].map(color => (
                    <label key={color} className="relative cursor-pointer">
                      <input type="radio" name="theme_color" value={color} defaultChecked={(business?.theme_color || 'indigo') === color} className="sr-only peer" />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform peer-checked:scale-110 ring-2 ring-offset-2 ring-transparent peer-checked:ring-slate-300 ${{
                        indigo: 'bg-indigo-600',
                        blue: 'bg-blue-600',
                        emerald: 'bg-emerald-600',
                        rose: 'bg-rose-600'
                      }[color]}`}>
                        <CheckCircle2 className="w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400"/> UI Density</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <label className="flex-1 text-center cursor-pointer relative">
                    <input type="radio" name="ui_density" value="cozy" defaultChecked={(business?.ui_density || 'cozy') === 'cozy'} className="sr-only peer" />
                    <div className="py-2 text-sm font-bold text-slate-600 peer-checked:text-indigo-900 peer-checked:bg-white rounded-lg transition-all peer-checked:shadow-sm">Cozy</div>
                  </label>
                  <label className="flex-1 text-center cursor-pointer relative">
                    <input type="radio" name="ui_density" value="compact" defaultChecked={(business?.ui_density || 'cozy') === 'compact'} className="sr-only peer" />
                    <div className="py-2 text-sm font-bold text-slate-600 peer-checked:text-indigo-900 peer-checked:bg-white rounded-lg transition-all peer-checked:shadow-sm">Compact</div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mt-6">
              <p className="text-xs text-slate-500 font-medium">Note: Visual appearance settings require a hard page reload (Cmd/Ctrl + R) to take full effect across all dashboards after saving.</p>
            </div>
          </div>

        </div>

        {/* Sticky Save Bar */}
        <div className="mt-auto pt-8 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium hidden md:block">Settings apply immediately to all newly drafted invoices.</p>
          <button 
            type="submit" 
            disabled={isPending}
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 w-full md:w-auto justify-center"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saved ? "Saved Securely!" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
