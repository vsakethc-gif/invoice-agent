'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Zap, Clock, Mail } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LandingPage() {
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0ea5e9', '#3b82f6', '#6366f1']
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans selection:bg-blue-200">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
            <span className="font-semibold text-lg tracking-tight text-slate-900">InvoiceNudge</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link 
              href="/signup" 
              className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6 tracking-wide uppercase">
              AI-Powered Accounts Receivable
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              Get paid faster without being the bad guy.
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
              InvoiceNudge automatically drafts and sends polite, perfectly-timed follow-ups for your overdue invoices, reading replies to intelligently pause or stop.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button 
                  onClick={triggerConfetti}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  Start your free trial <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="#how-it-works">
                <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-semibold text-lg hover:bg-slate-50 transition-colors">
                  See how it works
                </button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white"
        >
          <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="p-2 sm:p-0 bg-slate-50">
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=2000&q=80" 
              alt="Dashboard Preview" 
              className="w-full h-[400px] object-cover opacity-80"
            />
            {/* Overlay to abstract the stock image a bit */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent"></div>
          </div>
        </motion.div>

        {/* Features */}
        <div id="how-it-works" className="py-24 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Scheduling</h3>
              <p className="text-slate-600">Calculates exactly when to follow up based on due dates, skipping weekends and holidays so your emails land at the right time.</p>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"
            >
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Drafting</h3>
              <p className="text-slate-600">Generates polite, context-aware emails using LLMs, progressively escalating the tone while adhering to strict legal guardrails.</p>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"
            >
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Reply Handling</h3>
              <p className="text-slate-600">Reads inbound replies to instantly pause sequences if a customer says they've paid or promises a date, keeping you in the loop.</p>
            </motion.div>
          </div>
        </div>

        {/* Pricing */}
        <div className="py-12 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600 mb-12">No hidden fees, no percentage cuts. Just a flat monthly rate.</p>
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden max-w-md mx-auto">
            <div className="p-8 bg-slate-900 text-white">
              <h3 className="text-2xl font-bold mb-2">Pro Plan</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold">$29</span>
                <span className="text-slate-400">/mo</span>
              </div>
            </div>
            <div className="p-8 text-left">
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700">Unlimited invoices & reminders</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700">Custom email sending domain</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700">AI Reply Classification</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700">Strict Guardrails included</span>
                </li>
              </ul>
              <Link href="/signup">
                <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                  Get Started Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
              N
            </div>
            <span className="font-semibold text-slate-900">InvoiceNudge</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 InvoiceNudge. A demo application.
          </p>
        </div>
      </footer>
    </div>
  );
}
