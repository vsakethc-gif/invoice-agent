import { computeNextStep, isActionableNow } from "../src/utils/schedule";

console.log("=== Testing Schedule Engine ===");

// Helper to mock dates
const today = new Date();
const getDateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const runTest = (name: string, invoice: any, messages: any[], expected: string | null) => {
  const result = computeNextStep(invoice, messages);
  if (result === expected) {
    console.log(`✅ [PASS] ${name} -> ${result}`);
  } else {
    console.log(`❌ [FAIL] ${name} -> Expected ${expected}, got ${result}`);
    process.exitCode = 1;
  }
};

runTest("Invoice due in 4 days (no messages)", {
  due_date: getDateOffset(4), status: "upcoming"
}, [], null);

runTest("Invoice due in 3 days (needs Day -3)", {
  due_date: getDateOffset(3), status: "upcoming"
}, [], "Day -3");

runTest("Invoice due in 3 days (already sent Day -3)", {
  due_date: getDateOffset(3), status: "upcoming"
}, [{ step: "Day -3", created_at: getDateOffset(-1) }], null);

runTest("Invoice overdue by 2 days (needs Day +1, skips -3)", {
  due_date: getDateOffset(-2), status: "overdue"
}, [], "Day +1");

runTest("Invoice overdue by 8 days, Day +1 was sent yesterday (should throttle)", {
  due_date: getDateOffset(-8), status: "overdue"
}, [{ step: "Day +1", created_at: getDateOffset(-1) }], null);

runTest("Invoice overdue by 8 days, Day +1 was sent 4 days ago (needs Day +7)", {
  due_date: getDateOffset(-8), status: "overdue"
}, [{ step: "Day +1", created_at: getDateOffset(-4) }], "Day +7");

runTest("Paid invoice overdue by 10 days", {
  due_date: getDateOffset(-10), status: "paid"
}, [], null);

console.log("\n=== Testing Timezone Logic ===");
console.log("Current time actionable in UTC:", isActionableNow("UTC"));
console.log("Current time actionable in America/New_York:", isActionableNow("America/New_York"));
console.log("Current time actionable in Asia/Tokyo:", isActionableNow("Asia/Tokyo"));
