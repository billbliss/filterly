// classification/rulesets/premium.ts
import { RuleSet } from "../types.js";

const premiumNewsletterDomains = [
  "puck.news",
  "email.puck.news",
  "stratechery.com",
];

export const premiumNewslettersRuleset: RuleSet = {
  label: "PremiumNewsletters",
  threshold: 0.7,
  rules: [
    {
      id: "premium/from-domain",
      weight: 0.8,
      when: [{ op: "fromDomainIn", any: premiumNewsletterDomains }],
    },
    {
      id: "premium/links",
      weight: 0.3,
      any: true,
      when: [{ op: "linkHostIn", any: premiumNewsletterDomains }],
    },
  ],
};
