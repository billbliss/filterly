// classification/rulesets/action.ts
import { RuleSet } from "../types";

const actionPhrases = [
  /\baction required\b/i,
  /\bplease respond\b/i,
  /\brespond by\b/i,
  /\bcomplete (?:your )?(?:training|video)\b/i,
  /\bplan (?:updates?|changes?)\b/i,
];

const actionSenderDomains = ["rssc.com", "issaquahfinancial.com"];

export const actionRequiredRuleset: RuleSet = {
  label: "ActionRequired",
  threshold: 0.65,
  rules: [
    {
      id: "action/subject-phrases",
      weight: 0.4,
      when: [{ op: "textMatch", any: actionPhrases, scope: "subject" }],
    },
    {
      id: "action/body-phrases",
      weight: 0.25,
      when: [{ op: "textMatch", any: actionPhrases, scope: "body" }],
    },
    {
      id: "action/from-domains",
      weight: 0.35,
      when: [{ op: "fromDomainIn", any: actionSenderDomains }],
    },
  ],
};
