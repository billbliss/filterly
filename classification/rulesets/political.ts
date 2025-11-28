// classification/rulesets/political.ts
import { phrases } from "../predicates";
import { RuleSet } from "../types";

const politicalSenderDomains = [
  "e.turnoutpac.org",
  "turnoutpac.org",
  "e.savedemocracypac.com",
  "savedemocracypac.com",
  "leftaction.com",
  "catherinecortezmasto.com",
  "list.moveon.org",
  "moveon.org",
  "shared1.ccsend.com",
  "mail.house.gov",
  "sandyhookpromise.org",
];

export const politicalRuleset: RuleSet = {
  label: "PoliticalSolicitation",
  threshold: 0.7,
  moveEnabled: true,
  rules: [
    {
      id: "political/from-domains",
      weight: 0.5,
      when: [{ op: "fromDomainIn", any: politicalSenderDomains }],
    },
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
      weight: 0.2,
      when: [{ op: "textMatch", any: phrases.donate, scope: "both" }],
    },
    {
      id: "political/keywords",
      weight: 0.4,
      when: [
        { op: "textMatch", any: phrases.politicalKeywords, scope: "both" },
      ],
    },
    {
      id: "political/paid-for-footer",
      weight: 0.25,
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
