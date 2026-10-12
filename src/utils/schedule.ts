import { addDays, differenceInDays, isWeekend, getHours, parseISO } from "date-fns";

export const SCHEDULE_STEPS = [
  { step: "Day -3", offset: -3 },
  { step: "Day +1", offset: 1 },
  { step: "Day +7", offset: 7 },
  { step: "Day +14", offset: 14 },
  { step: "Day +30", offset: 30 },
];

export function computeNextStep(invoice: any, sentMessages: any[]) {
  // If invoice is closed, no step
  if (["paid", "disputed", "paused"].includes(invoice.status)) {
    return null;
  }

  const dueDate = parseISO(invoice.due_date);
  const now = new Date();
  
  // Calculate days overdue (negative means upcoming)
  // Simplified by comparing UTC starts of day, but normally we'd use timezone.
  const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  // Find the highest step that we SHOULD have sent by now
  const dueSteps = SCHEDULE_STEPS.filter(s => daysDiff >= s.offset).sort((a, b) => b.offset - a.offset);

  if (dueSteps.length === 0) return null; // Too early for any step

  // We want to send the highest due step that hasn't been sent yet
  const sentStepNames = sentMessages.map(m => m.step);
  
  for (const candidate of dueSteps) {
    if (!sentStepNames.includes(candidate.step)) {
      // We found a step we should send!
      
      // Safety check: Never send more than one message per 3 days
      if (sentMessages.length > 0) {
        // Sort by most recent
        const lastSent = sentMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const daysSinceLast = differenceInDays(now, new Date(lastSent.created_at));
        if (daysSinceLast < 3) {
          return null; // Throttle
        }
      }
      return candidate.step;
    }
  }

  // If we get here, all due steps have been sent. If we passed Day +30, we should mark as Needs Attention.
  // We can return a special token for that.
  if (daysDiff > 30 && !sentStepNames.includes("Needs Attention")) {
    return "Needs Attention";
  }

  return null;
}

export function isActionableNow(timezone: string) {
  // Try to parse current time in target timezone
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
      weekday: 'short'
    });
    
    const parts = formatter.formatToParts(new Date());
    const hourStr = parts.find(p => p.type === 'hour')?.value;
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value;

    if (!hourStr || !weekdayStr) return false;

    const hour = parseInt(hourStr, 10);
    const isWeekendDay = weekdayStr === 'Sat' || weekdayStr === 'Sun';

    // Must be Mon-Fri, 9am - 5pm (17)
    if (isWeekendDay) return false;
    if (hour < 9 || hour >= 17) return false;

    return true;
  } catch (e) {
    // If timezone is invalid, fallback to UTC generic check
    const hour = new Date().getUTCHours();
    const day = new Date().getUTCDay();
    if (day === 0 || day === 6) return false;
    if (hour < 13 || hour >= 21) return false; // 9am-5pm EST in UTC roughly
    return true;
  }
}
