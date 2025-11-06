// classification/rulesets/phishing.ts
import { phrases } from "../predicates";
import { RuleSet } from "../types";

export const phishingRuleset: RuleSet = {
  label: "PhishingSuspect",
  threshold: 0.7,
  rules: [
    {
      id: "phish/replyto-mismatch",
      weight: 0.25,
      when: [{ op: "replyToDomainMismatch" }],
    },
    {
      id: "phish/auth-failed",
      weight: 0.25,
      when: [{ op: "authFailed" }],
    },
    {
      id: "phish/link-mismatch",
      weight: 0.25,
      when: [{ op: "visibleHrefHostMismatch" }],
    },
    {
      id: "phish/urgency-language",
      weight: 0.2,
      when: [{ op: "textMatch", any: phrases.phishingUrgency, scope: "both" }],
    },
    {
      id: "phish/suspicious-attachment",
      weight: 0.2,
      when: [
        {
          op: "attachmentExtIn",
          any: ["html", "htm", "iso", "img", "js", "vbs", "scr", "lnk", "exe"],
        },
      ],
    },
    {
      id: "phish/brand-spoof",
      weight: 0.15,
      when: [{ op: "textMatch", any: phrases.brandSpoof, scope: "both" }],
    },
  ],
};
