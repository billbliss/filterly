// classification/classify.ts
import { mapToFolder } from "./folderMap";
import { classifyByRules } from "./runRules";
import { MessageFeatures } from "./types";

// Labels that are "auxiliary" badges rather than primary destinations.
// (You can keep or tweak this as your taxonomy evolves.)
const AUX_LABELS = new Set([
  "FromVIP",
  "FromKnownContact",
  "Noreply",
  "Notifications",
  "Autoreplies",
  "Bulk",
]);

// Higher number = higher priority when confidences are close.
// You can tune these without touching rulesets.
const PRIORITY: Record<string, number> = {
  PhishingSuspect: 100,
  SpamSuspect: 95,
  ActionRequired: 90,
  ApprovePay: 88,
  ReplyRequested: 85,
  Receipts: 80,
  OrdersShipping: 78,
  FinanceBilling: 76,
  CalendarItinerary: 70,
  Travel: 68,
  PoliticalSolicitation: 60,
  Updates: 70,
  Newsletters: 48,
  Promotions: 46,
  PremiumNewsletters: 55,
};

const DEFAULT_PRIORITY = 10;

// If two labels are close in confidence, break ties with priority.
const CLOSE_DELTA = 0.05;

export interface Classified {
  primaryLabel: string;
  primaryFolder: string;
  results: Array<{
    label: string;
    confidence: number;
    folder: string;
    evidence: { rule: string; detail?: string }[];
    moveEnabled: boolean;
  }>;
}

/**
 * Choose a primary label from rule hits, preferring higher confidence,
 * then higher PRIORITY if confidences are close. Skip purely-aux labels.
 */
function choosePrimary(results: Classified["results"]): string | "Unknown" {
  if (!results.length) return "Unknown";
  // Sort by confidence desc, then priority desc
  const sorted = [...results].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const pa = PRIORITY[a.label] ?? DEFAULT_PRIORITY;
    const pb = PRIORITY[b.label] ?? DEFAULT_PRIORITY;
    return pb - pa;
  });

  // Highest confidence candidate
  const top = sorted[0];

  // If top is auxiliary and there’s a close runner-up non-aux, pick the runner-up
  if (AUX_LABELS.has(top.label) && sorted.length > 1) {
    const runner = sorted.find((r) => !AUX_LABELS.has(r.label));
    if (runner && top.confidence - runner.confidence <= CLOSE_DELTA) {
      return runner.label;
    }
  }

  // Otherwise, if top is non-aux OR there is no better alternative, select top
  if (!AUX_LABELS.has(top.label)) return top.label;

  // If everything is auxiliary, fall back to top anyway
  return top.label;
}

/**
 * Public entry point used by the rest of your app.
 * - Runs all rulesets
 * - Picks a primary label with stable tie-breaking
 * - Maps to your minimal folder set
 */
export function classify(features: MessageFeatures): Classified {
  const ruleHits = classifyByRules(features);

  const results = ruleHits.map((r) => ({
    ...r,
    folder: mapToFolder(r.label),
  }));

  const primaryLabel = choosePrimary(results);
  const primaryFolder = mapToFolder(primaryLabel);

  return {
    primaryLabel,
    primaryFolder,
    results,
  };
}

export default classify;
