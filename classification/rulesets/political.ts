// classification/rulesets/political.ts
import { phrases } from "../predicates.js";
import { RuleSet } from "../types.js";

export const politicalRuleset: RuleSet = {
  label: "PoliticalSolicitation",
  threshold: 0.6,
  rules: [
    {
      id: "political/platform-link",
      weight: 0.45,
      when: [
        {
          op: "linkHostIn",
          any: ["secure.actblue.com", "winred.com", "mail.winred.com"],
        },
      ],
    },
    {
      id: "political/donation-language",
      weight: 0.4,
      when: [{ op: "textMatch", any: phrases.donate, scope: "both" }],
    },
    {
      id: "political/paid-for-footer",
      weight: 0.6,
      when: [{ op: "textMatch", any: phrases.politicalFooter, scope: "both" }],
    },
    {
      id: "political/newsletterish",
      weight: 0.15,
      any: true,
      when: [
        { op: "flagTrue", key: "hasListId" },
        { op: "flagTrue", key: "hasUnsubscribe" },
      ],
    },
  ],
};
