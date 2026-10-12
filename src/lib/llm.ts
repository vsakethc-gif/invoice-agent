/**
 * llm.ts — the ONE place the app talks to an AI model.
 *
 * To swap providers later, change LLM_PROVIDER / LLM_MODEL in .env.local and
 * add a branch in callModel(). Nothing else in the app needs to change.
 *
 * Safety: every model output is checked by checkEmailGuardrails(). On failure we
 * retry (max 2 retries = 3 attempts), then fall back to a compliant template.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  InvoiceContext,
  checkEmailGuardrails,
  getSafeFallbackTemplate,
  formatLongDate,
  formatMoney,
  MAX_BODY_WORDS,
} from "./guardrails";

export type Tone = "Friendly" | "Professional" | "Firm";

export interface DraftingRequest {
  context: InvoiceContext;
  days_overdue: number;
  tone: Tone;
  step: string;
  prior_messages?: { direction: string; body: string }[];
}

export type FallbackReason = "no_api_key" | "guardrail_violation" | "llm_error" | null;

export interface DraftEmailResponse {
  subject: string;
  body: string;
  guardrails_passed: boolean;
  violations: string[];
  used_fallback: boolean;
  fallback_reason: FallbackReason;
  attempts: number;
}

const PROVIDER = process.env.LLM_PROVIDER || "gemini";
const MODEL = process.env.LLM_MODEL || "gemini-3.8-flash";
const MAX_ATTEMPTS = 3; // 1 try + 2 retries

function hasApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== "your-gemini-api-key";
}

/** Low-level call. Add other providers here (OpenAI, Anthropic...) if needed. */
async function callModel(prompt: string): Promise<string> {
  if (PROVIDER === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
  throw new Error(`Unsupported LLM_PROVIDER "${PROVIDER}"`);
}

function stepGuidance(step: string): string {
  switch (step) {
    case "Day -3":
      return "This is a friendly heads-up BEFORE the due date. Do not say it is late.";
    case "Day +1":
      return "The invoice is 1 day past due. Friendly 'just checking in' — assume it was an oversight.";
    case "Day +7":
      return "Professional reminder. Courteous and clear.";
    case "Day +14":
      return "Firm but polite second notice. Ask them to reply with an expected payment date.";
    case "Day +30":
      return "Final notice written personally by the owner. Ask them to reply with a payment date, or the owner will follow up personally. No threats.";
    default:
      return "A courteous follow-up requested manually by the owner.";
  }
}

function buildPrompt(req: DraftingRequest): string {
  const { context: c, days_overdue, tone, step, prior_messages = [] } = req;
  const money = formatMoney(c.amount, c.currency || "USD");
  const due = formatLongDate(c.due_date);
  const thread = prior_messages.length
    ? prior_messages
        .slice(-4)
        .map((m) => `[${m.direction}] ${m.body.slice(0, 400)}`)
        .join("\n---\n")
    : "(no prior messages)";

  return `You write short payment reminder emails for a small business owner. You ARE the owner, writing in first person.

FACTS (use exactly, never change):
- Business: ${c.business_name}
- Owner (sign the email with this name): ${c.owner_name}
- Customer: ${c.customer_name}
- Invoice number: ${c.invoice_number}
- Amount: ${money}
- Due date: ${due}
- Days overdue: ${days_overdue} (negative = not yet due)
- Payment link: ${c.payment_link || "none"}

SCHEDULE STEP: ${step}. ${stepGuidance(step)}
TONE: ${tone}

PRIOR THREAD (most recent last):
${thread}

HARD RULES — breaking any of these makes the email unusable:
1. Never mention lawsuits, legal action, courts, attorneys, collections/collection agencies, credit reporting, seizure/garnishment/liens, police, or any harm.
2. Never invent or change amounts, dates, fees, interest or penalties. Do not mention any fees. Only use the facts above.
3. Never claim to be a collection agency, attorney, law firm, or government. You are ${c.owner_name} from ${c.business_name}.
4. No shaming, insults, ultimatums or pressure tactics. Always courteous.
5. MUST include: invoice number ${c.invoice_number}, the amount written exactly as ${money}, the due date written exactly as ${due}${c.payment_link ? `, and the payment link ${c.payment_link}` : ""}.
6. Body under ${MAX_BODY_WORDS - 20} words. Plain text, no markdown.
7. End with:
Best regards,
${c.owner_name}
${c.business_name}

Respond in EXACTLY this format:
SUBJECT: <subject line>
BODY:
<email body>`;
}

/** Parses "SUBJECT: ... BODY: ..." from model output. */
export function parseLLMResponse(text: string): { subject: string; body: string } | null {
  const cleaned = text.replace(/```[a-z]*\n?|```/gi, "").trim();
  const subjectMatch = cleaned.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = cleaned.match(/BODY:\s*([\s\S]+)/i);
  if (subjectMatch && bodyMatch) {
    return { subject: subjectMatch[1].trim(), body: bodyMatch[1].trim() };
  }
  return null;
}

/**
 * Generates a reminder email. Always returns a compliant email (AI or template).
 */
export async function generateDraftEmail(req: DraftingRequest): Promise<DraftEmailResponse> {
  const ctx = { ...req.context, step: req.step };
  const fallback = (reason: FallbackReason, violations: string[], attempts: number): DraftEmailResponse => {
    const t = getSafeFallbackTemplate(ctx, req.tone);
    return {
      ...t,
      guardrails_passed: true,
      violations,
      used_fallback: true,
      fallback_reason: reason,
      attempts,
    };
  };

  if (!hasApiKey()) return fallback("no_api_key", [], 0);

  let lastViolations: string[] = [];
  let attempts = 0;
  try {
    const prompt = buildPrompt({ ...req, context: ctx });
    for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
      const text = await callModel(
        attempts === 1
          ? prompt
          : `${prompt}\n\nYour previous draft was REJECTED for: ${lastViolations.join("; ")}. Fix these issues.`
      );
      const parsed = parseLLMResponse(text);
      if (!parsed) {
        lastViolations = ["Response was not in SUBJECT/BODY format."];
        continue;
      }
      const check = checkEmailGuardrails(parsed.subject, parsed.body, ctx);
      if (check.passed) {
        return { ...parsed, guardrails_passed: true, violations: [], used_fallback: false, fallback_reason: null, attempts };
      }
      lastViolations = check.violations;
      console.warn(`[guardrails] attempt ${attempts} rejected:`, check.violations);
    }
    return fallback("guardrail_violation", lastViolations, MAX_ATTEMPTS);
  } catch (err) {
    console.error("[llm] generation error:", err);
    return fallback("llm_error", [String((err as Error)?.message || err)], attempts);
  }
}

/** Used in the UI / DECISIONS.md so you can see which model is active. */
export function activeModelLabel(): string {
  return hasApiKey() ? `${PROVIDER}:${MODEL}` : "safe templates (no GEMINI_API_KEY set)";
}

export type ReplyClassification = "promise_to_pay" | "already_paid" | "dispute" | "asks_for_info" | "unsubscribe" | "out_of_office" | "other";

/**
 * Classifies an inbound email reply using the LLM.
 */
export async function classifyReply(subject: string, body: string): Promise<ReplyClassification> {
  if (!hasApiKey()) return "other";
  
  const prompt = `You are an AI assistant categorizing an inbound email reply from a customer regarding an invoice.
Read the email and classify it into EXACTLY ONE of these categories:
1. "promise_to_pay" (They say they will pay, giving a date or just saying they're on it)
2. "already_paid" (They claim they already paid it)
3. "dispute" (They are angry, refusing to pay, disputing the amount, or claiming service wasn't delivered)
4. "asks_for_info" (They are asking a question, requesting a receipt, w-9, or more details)
5. "unsubscribe" (They ask to stop emailing them or unsubscribe)
6. "out_of_office" (Automated out of office reply)
7. "other" (None of the above fit well)

Subject: ${subject}
Body:
${body.substring(0, 2000)}

Reply with ONLY the category string (e.g. dispute).`;

  try {
    const text = await callModel(prompt);
    const cleaned = text.trim().toLowerCase();
    
    if (cleaned.includes("promise_to_pay")) return "promise_to_pay";
    if (cleaned.includes("already_paid")) return "already_paid";
    if (cleaned.includes("dispute")) return "dispute";
    if (cleaned.includes("asks_for_info")) return "asks_for_info";
    if (cleaned.includes("unsubscribe")) return "unsubscribe";
    if (cleaned.includes("out_of_office")) return "out_of_office";
    
    return "other";
  } catch (err) {
    console.error("[llm] classification error:", err);
    return "other";
  }
}
