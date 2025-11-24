// classification/movePolicy.ts
const MOVE_THRESHOLD: Record<string, number> = {
  Promotions: 0.9,
  Newsletters: 0.9,
  Updates: 0.9,
  SpamSuspect: 0.7,
  PhishingSuspect: 0.7,
};

export function shouldMoveFromInbox({
  primaryLabel,
  confidence,
  moveEnabled,
}: {
  primaryLabel: string;
  confidence: number;
  moveEnabled: boolean;
}) {
  if (!moveEnabled) return false;
  const min = MOVE_THRESHOLD[primaryLabel];
  if (typeof min !== "number") return true;
  return confidence >= min;
}
