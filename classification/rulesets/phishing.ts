// classification/rulesets/phishing.ts
import { phrases } from "../predicates";
import { RuleSet } from "../types";

const microsoftAuthDomains = [
  "microsoft.com",
  ".microsoft.com",
  "office.com",
  ".office.com",
  "outlook.com",
  ".outlook.com",
  "live.com",
  ".live.com",
  "sharepoint.com",
  ".sharepoint.com",
  "sharepointonline.com",
  ".sharepointonline.com",
  "microsoftonline.com",
  ".microsoftonline.com",
];

export const phishingRuleset: RuleSet = {
  label: "PhishingSuspect",
  moveEnabled: true,
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
    {
      id: "phish/m365-invite",
      weight: 0.75,
      when: [
        { op: "attachmentExtIn", any: ["ics"] },
        { op: "textMatch", any: phrases.office365Mention, scope: "both" },
        { op: "textMatch", any: phrases.office365Urgency, scope: "both" },
      ],
    },
    {
      id: "phish/docusign-spoof",
      weight: 0.8,
      when: [
        { op: "textMatch", any: phrases.docuSignMention, scope: "both" },
        {
          op: "fromDomainNotIn",
          none: [
            "docusign.net",
            "docusign.com",
            ".docusign.net",
            "docusignmail.net",
            "linkedin.com",
            ".linkedin.com",
            "linkedinmail.com",
            ".linkedinmail.com",
          ],
        },
      ],
    },
    {
      id: "phish/m365-login-spoof",
      weight: 0.85,
      when: [
        { op: "textMatch", any: phrases.office365Mention, scope: "both" },
        { op: "textMatch", any: phrases.phishingUrgency, scope: "both" },
        { op: "fromDomainNotIn", none: microsoftAuthDomains },
      ],
    },
  ],
};
