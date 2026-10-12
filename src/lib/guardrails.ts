/**
 * Code-level Guardrail Checker for InvoiceNudge
 *
 * Every AI-written (or owner-edited) email passes through checkEmailGuardrails()
 * BEFORE it can be approved or sent. If the AI keeps failing, we fall back to a
 * pre-written template that is known to be compliant.
 */

export interface InvoiceContext {
  invoice_number: string;
  amount: number | string;
  currency?: string;
  due_date: string; // YYYY-MM-DD
  payment_link?: string;
  business_name: string;
  owner_name: string;
  customer_name: string;
  step?: string;
}

export interface GuardrailCheckResult {
  passed: boolean;
  violations: string[];
}

export const MAX_BODY_WORDS = 130;

// Banned phrases: legal threats, collector impersonation, credit reporting, seizure, police, shaming, fees.
const FORBIDDEN_PATTERNS: { regex: RegExp; reason: string }[] = [
  {
    regex: /\b(lawsuits?|sue|suing|legal action|court|attorneys?|lawyers?|litigat\w*|subpoena|legal proceedings|small claims)\b/i,
    reason: "Threat of legal action or attorney involvement is not allowed.",
  },
  {
    regex: /\b(collection agency|collections agency|debt collector|collections department|third[- ]party collector|sent to collections|turn(ed)? over to collections)\b/i,
    reason: "Mentions collections / claims to be a debt collector.",
  },
  {
    regex: /\b(credit reports?|credit bureaus?|experian|equifax|transunion|credit score|report you)\b/i,
    reason: "Threat to report to credit bureaus is not allowed.",
  },
  {
    regex: /\b(seize|seizure|garnish\w*|freeze your accounts?|liens?|repossess\w*)\b/i,
    reason: "Threat of wage/asset seizure or liens is not allowed.",
  },
  {
    regex: /\b(police|sheriff|arrest\w*|criminal|jail|prosecut\w*|fraud)\b/i,
    reason: "Mentions police or criminal action.",
  },
  {
    regex: /\b(deadbeat|shame\w*|ashamed|humiliat\w*|irresponsible|disgrace\w*|pathetic|unacceptable behavior)\b/i,
    reason: "Shaming or insulting language is not allowed.",
  },
  {
    regex: /\b(late fees?|interest charges?|accrued interest|penalt(y|ies)|surcharge)\b/i,
    reason: "Mentions fees, interest, or penalties the owner did not set.",
  },
  {
    regex: /\b(final warning|last chance|or else|immediately or|within 24 hours|consequences)\b/i,
    reason: "High-pressure tactics are not allowed.",
  },
  {
    regex: /\b(on behalf of the government|irs|government agency|law firm)\b/i,
    reason: "Deceptive claim about who is sending the message.",
  },
];

/** "2026-10-09" -> "October 9, 2026" */
export function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

/** 4500 -> "$4,500.00" */
export function formatMoney(amount: number | string, currency = "USD"): string {
  const n = Number(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(isNaN(n) ? 0 : n);
}

/** All the ways an amount might legitimately be written, e.g. 4500 -> ["4,500.00","4500.00","4,500","4500"] */
function amountVariants(amount: number): string[] {
  const variants = new Set<string>([
    amount.toFixed(2),
    amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ]);
  if (Number.isInteger(amount)) {
    variants.add(String(amount));
    variants.add(amount.toLocaleString("en-US"));
  }
  return [...variants];
}

/**
 * Validates drafted email text against mandatory compliance guardrails.
 */
export function checkEmailGuardrails(subject: string, body: string, ctx: InvoiceContext): GuardrailCheckResult {
  const violations: string[] = [];
  const fullText = `${subject}\n${body}`;
  const lower = fullText.toLowerCase();

  // 1. Banned phrases
  for (const { regex, reason } of FORBIDDEN_PATTERNS) {
    if (regex.test(fullText)) violations.push(reason);
  }

  // 2. Length
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_BODY_WORDS) {
    violations.push(`Email body is too long (${wordCount} words; max ${MAX_BODY_WORDS}).`);
  }

  // 3. Invoice number present
  if (!lower.includes(ctx.invoice_number.trim().toLowerCase())) {
    violations.push(`Missing invoice number "${ctx.invoice_number}".`);
  }

  // 4. Amount present AND no other dollar amounts invented
  const amount = Number(ctx.amount);
  if (!isNaN(amount)) {
    const variants = amountVariants(amount);
    if (!variants.some((v) => fullText.includes(v))) {
      violations.push(`Missing the invoice amount (${formatMoney(amount, ctx.currency)}).`);
    }
    const dollarMatches = fullText.match(/\$\s?\d[\d,]*(\.\d{1,2})?/g) || [];
    for (const m of dollarMatches) {
      const value = Number(m.replace(/[$,\s]/g, ""));
      if (Math.abs(value - amount) > 0.005) {
        violations.push(`Contains an amount (${m.trim()}) that does not match the invoice.`);
        break;
      }
    }
  }

  // 5. Due date present (ISO or "October 9, 2026")
  if (ctx.due_date) {
    const long = formatLongDate(ctx.due_date).toLowerCase();
    if (!lower.includes(ctx.due_date) && !lower.includes(long)) {
      violations.push(`Missing the due date (${formatLongDate(ctx.due_date)}).`);
    }
  }

  // 6. Payment link present (if one exists)
  if (ctx.payment_link && ctx.payment_link.trim() !== "") {
    if (!lower.includes(ctx.payment_link.trim().toLowerCase())) {
      violations.push("Missing the payment link.");
    }
  }

  // 7. Must be signed by the owner (no impersonating anyone else)
  if (ctx.owner_name && !lower.includes(ctx.owner_name.trim().toLowerCase())) {
    violations.push(`Not signed by the owner (${ctx.owner_name}).`);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Deterministic, compliant fallback templates.
 * Used when no AI key is configured, or the AI fails the checker 3 times.
 */
export function getSafeFallbackTemplate(
  ctx: InvoiceContext,
  tone: "Friendly" | "Professional" | "Firm" = "Professional"
): { subject: string; body: string } {
  const money = formatMoney(ctx.amount, ctx.currency || "USD");
  const due = formatLongDate(ctx.due_date);
  const pay = ctx.payment_link ? `\n\nYou can pay online here: ${ctx.payment_link}` : "";
  const sign = `\n\nBest regards,\n${ctx.owner_name}\n${ctx.business_name}`;

  // Step-specific: upcoming heads-up
  if (ctx.step === "Day -3") {
    return {
      subject: `Upcoming: Invoice ${ctx.invoice_number} due ${due}`,
      body: `Hi ${ctx.customer_name},\n\nJust a friendly heads-up that invoice ${ctx.invoice_number} for ${money} is due on ${due}.${pay}\n\nThank you for your business!${sign}`,
    };
  }

  // Step-specific: final notice in the owner's own voice
  if (ctx.step === "Day +30") {
    return {
      subject: `Invoice ${ctx.invoice_number} — a personal note from ${ctx.owner_name}`,
      body: `Hi ${ctx.customer_name},\n\nI'm reaching out personally about invoice ${ctx.invoice_number} for ${money}, which was due on ${due}.${pay}\n\nCould you reply with a date when payment will be sent? If I don't hear back, I'll follow up with you personally. If there's an issue with the invoice, please let me know so we can sort it out.${sign}`,
    };
  }

  if (tone === "Friendly") {
    return {
      subject: `Quick check-in: Invoice ${ctx.invoice_number} from ${ctx.business_name}`,
      body: `Hi ${ctx.customer_name},\n\nHope all is well! Just checking in on invoice ${ctx.invoice_number} for ${money}, which was due on ${due}.${pay}\n\nIf it's already on its way, thank you — please ignore this note.${sign}`,
    };
  }

  if (tone === "Firm") {
    return {
      subject: `Second notice: Invoice ${ctx.invoice_number} - ${ctx.business_name}`,
      body: `Hi ${ctx.customer_name},\n\nThis is a second notice that invoice ${ctx.invoice_number} for ${money}, due on ${due}, remains unpaid.${pay}\n\nPlease reply with your expected payment date. If you have any questions about this invoice, I'm happy to help.${sign}`,
    };
  }

  return {
    subject: `Reminder: Invoice ${ctx.invoice_number} - ${ctx.business_name}`,
    body: `Hello ${ctx.customer_name},\n\nI'm following up on invoice ${ctx.invoice_number} for ${money}, which was due on ${due}.${pay}\n\nCould you let me know when we can expect payment?${sign}`,
  };
}
