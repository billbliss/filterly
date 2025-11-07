// classification/movePolicy.ts
const MOVE_THRESHOLD: Record<string, number> = {
  Promotions: 0.9,
  Newsletters: 0.9,
  Updates: 0.9,
  PoliticalSolicitation: 0.8,
  SpamSuspect: 0.7,
  PhishingSuspect: 0.7,
};

const NEVER_MOVE = new Set([
  "ActionRequired",
  "FinanceBilling",
  "OrdersShipping",
  "Travel",
  "CalendarItinerary",
  "Receipts",
]);

export function shouldMoveFromInbox({
  primaryLabel,
  confidence,
}: {
  primaryLabel: string;
  confidence: number;
}) {
  if (NEVER_MOVE.has(primaryLabel)) return false;
  const min = MOVE_THRESHOLD[primaryLabel];
  if (typeof min !== "number") return false;
  return confidence >= min;
}
