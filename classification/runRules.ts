// classification/runRules.ts
import { runRuleSet } from "./engine";
import { conversationRuleset } from "./rulesets/conversation";
import {
  financeRuleset,
  ordersShippingRuleset,
  receiptsRuleset,
} from "./rulesets/finance";
import {
  newslettersRuleset,
  promotionsRuleset,
  updatesRuleset,
} from "./rulesets/marketing";
import { phishingRuleset } from "./rulesets/phishing";
import { politicalRuleset } from "./rulesets/political";
import { premiumNewslettersRuleset } from "./rulesets/premium";
import { calendarItineraryRuleset, travelRuleset } from "./rulesets/travel";
import { DetectionResult, MessageFeatures, RuleSet } from "./types";

const RULESETS: RuleSet[] = [
  // Personal / Conversations
  conversationRuleset,
  premiumNewslettersRuleset,
  // Finance / Money & Orders
  receiptsRuleset,
  financeRuleset,
  ordersShippingRuleset,
  // Travel & Calendar
  travelRuleset,
  calendarItineraryRuleset,
  // Marketing
  promotionsRuleset,
  newslettersRuleset,
  updatesRuleset,
  // Political Solicitation
  politicalRuleset,
  // Phishing Suspect
  phishingRuleset,
];

export function classifyByRules(f: MessageFeatures): DetectionResult[] {
  const results: DetectionResult[] = [];
  RULESETS.forEach((rs) => {
    try {
      const r = runRuleSet(f, rs);
      if (r) results.push(r);
    } catch (e) {
      // swallow to isolate failures per ruleset
    }
  });
  return results.sort((a, b) => b.confidence - a.confidence);
}
