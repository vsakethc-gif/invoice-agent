/**
 * Guardrail checker tests. Run with:  npm test
 * Exits with code 1 if any test fails.
 */
import { checkEmailGuardrails, getSafeFallbackTemplate, type InvoiceContext } from "../src/lib/guardrails";
import { parseLLMResponse } from "../src/lib/llm";

let failures = 0;
function expect(name: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`✅ [PASS] ${name}`);
  else {
    failures++;
    console.log(`❌ [FAIL] ${name}`, detail ?? "");
  }
}

const ctx: InvoiceContext = {
  invoice_number: "INV-1042",
  amount: 4500,
  currency: "USD",
  due_date: "2026-09-25",
  payment_link: "https://pay.stripe.com/abc123",
  business_name: "Acme HVAC",
  owner_name: "Jane Doe",
  customer_name: "BlueSky Logistics",
};

const goodBody = `Hi BlueSky Logistics,

I'm following up on invoice INV-1042 for $4,500.00, which was due on September 25, 2026.

You can pay online here: https://pay.stripe.com/abc123

Best regards,
Jane Doe
Acme HVAC`;

console.log("=== Guardrail checker ===");

expect("Clean email passes", checkEmailGuardrails("Reminder: INV-1042", goodBody, ctx).passed,
  checkEmailGuardrails("Reminder: INV-1042", goodBody, ctx).violations);

const banned: [string, string][] = [
  ["lawsuit threat", "If unpaid we will file a lawsuit."],
  ["attorney mention", "Our attorney will contact you."],
  ["collections", "This will be sent to collections."],
  ["credit bureau", "We may report this to the credit bureaus."],
  ["garnishment", "We will garnish wages."],
  ["police", "We will contact the police."],
  ["shaming", "Frankly this is irresponsible."],
  ["late fee", "A late fee of 5% now applies."],
  ["pressure", "This is your last chance."],
  ["impersonating law firm", "Writing on behalf of our law firm."],
];
for (const [name, sentence] of banned) {
  const r = checkEmailGuardrails("Reminder", `${goodBody}\n${sentence}`, ctx);
  expect(`Blocks ${name}`, !r.passed, r.violations);
}

expect("Blocks invented amount",
  !checkEmailGuardrails("Reminder", goodBody.replace("$4,500.00", "$4,950.00"), ctx).passed);
expect("Blocks extra dollar amount",
  !checkEmailGuardrails("Reminder", `${goodBody}\nPlus $50 processing.`, ctx).passed);
expect("Blocks missing invoice number",
  !checkEmailGuardrails("Reminder", goodBody.replace("INV-1042", "your invoice"), ctx).passed);
expect("Blocks missing payment link",
  !checkEmailGuardrails("Reminder", goodBody.replace("https://pay.stripe.com/abc123", "our portal"), ctx).passed);
expect("Blocks missing due date",
  !checkEmailGuardrails("Reminder", goodBody.replace("September 25, 2026", "recently"), ctx).passed);
expect("Blocks missing owner signature",
  !checkEmailGuardrails("Reminder", goodBody.replace("Jane Doe", "The Team"), ctx).passed);
expect("Blocks over-long body",
  !checkEmailGuardrails("Reminder", `${goodBody}\n${"word ".repeat(140)}`, ctx).passed);
expect("ISO due date is accepted",
  checkEmailGuardrails("Reminder", goodBody.replace("September 25, 2026", "2026-09-25"), ctx).passed);
expect("No payment link required when none exists",
  checkEmailGuardrails("R", goodBody.replace("https://pay.stripe.com/abc123", "our portal"), { ...ctx, payment_link: undefined }).passed);

console.log("\n=== Fallback templates are always compliant ===");
for (const step of ["Day -3", "Day +1", "Day +7", "Day +14", "Day +30", "Manual"]) {
  for (const tone of ["Friendly", "Professional", "Firm"] as const) {
    const c = { ...ctx, step };
    const t = getSafeFallbackTemplate(c, tone);
    const r = checkEmailGuardrails(t.subject, t.body, c);
    expect(`Template ${step} / ${tone}`, r.passed, r.violations);
  }
}
const noLink = { ...ctx, payment_link: undefined, amount: 1850.5 };
const t2 = getSafeFallbackTemplate(noLink, "Professional");
expect("Template without payment link + cents amount", checkEmailGuardrails(t2.subject, t2.body, noLink).passed,
  checkEmailGuardrails(t2.subject, t2.body, noLink).violations);

console.log("\n=== LLM response parsing ===");
const parsed = parseLLMResponse("SUBJECT: Hello there\nBODY:\nLine one\nLine two");
expect("Parses SUBJECT/BODY", parsed?.subject === "Hello there" && parsed?.body === "Line one\nLine two", parsed);
expect("Rejects unstructured output", parseLLMResponse("just some text") === null);

console.log(failures ? `\n${failures} test(s) FAILED` : "\nAll guardrail tests passed.");
if (failures) process.exit(1);
