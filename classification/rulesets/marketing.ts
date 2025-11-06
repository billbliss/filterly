// classification/rulesets/marketing.ts
import { RuleSet } from "../types";

const marketingPhrases = {
  promo: [
    /\b(offer|sale|save|% off|discount|coupon|promo code)\b/i,
    /\bends (tonight|soon|today)\b/i,
    /\blimited time\b/i,
    /\bdoorbuster\b/i,
  ],
  newsletter: [
    /\bunsubscribe\b/i,
    /\bpreferences\b/i,
    /\byou are receiving this\b/i,
    /\bdaily digest\b/i,
    /\bweekly roundup\b/i,
    /\bnewsletter\b/i,
  ],
  update: [
    /\brelease notes?\b/i,
    /\bwhat's new\b/i,
    /\bchangelog\b/i,
    /\bservice (update|outage|incident|resolved)\b/i,
    /\bmaintenance window\b/i,
  ],
};

const newsletterDomainHosts = [
  "email.seattletimes.com",
  "news.seattletimes.com",
  "email.puck.news",
  "puck.news",
  "stratechery.com",
  "substack.com",
];

export const promotionsRuleset: RuleSet = {
  label: "Promotions",
  threshold: 0.7,
  rules: [
    {
      id: "promo/keywords",
      weight: 0.4,
      when: [{ op: "textMatch", any: marketingPhrases.promo, scope: "both" }],
    },
    {
      id: "promo/listid+unsubscribe",
      weight: 0.25,
      when: [
        { op: "flagTrue", key: "hasListId" },
        { op: "flagTrue", key: "hasUnsubscribe" },
      ],
    },
    {
      id: "promo/storefront-hosts",
      weight: 0.2,
      when: [
        {
          op: "linkHostIn",
          any: [
            "amazon.com",
            "bestbuy.com",
            "target.com",
            "walmart.com",
            "costco.com",
            "ebay.com",
            "shop.app",
            "shopify.com",
            "mailchi.mp",
          ],
        },
      ],
    },
  ],
};

export const newslettersRuleset: RuleSet = {
  label: "Newsletters",
  threshold: 0.7,
  rules: [
    {
      id: "news/unsubscribe",
      weight: 0.35,
      when: [{ op: "flagTrue", key: "hasUnsubscribe" }],
    },
    {
      id: "news/list-id",
      weight: 0.25,
      when: [{ op: "flagTrue", key: "hasListId" }],
    },
    {
      id: "news/newsletterish-phrases",
      weight: 0.25,
      when: [
        { op: "textMatch", any: marketingPhrases.newsletter, scope: "both" },
      ],
    },
    {
      id: "news/esp-hosts",
      weight: 0.15,
      when: [
        {
          op: "linkHostIn",
          any: [
            "list-manage.com",
            "sendgrid.net",
            "cmail20.com",
            "mailchimp.com",
            "campaign-archive.com",
            "convertkit-mail.com",
            "substack.com",
          ],
        },
      ],
    },
    {
      id: "news/newsletter-domains",
      weight: 0.4,
      when: [{ op: "linkHostIn", any: newsletterDomainHosts }],
    },
  ],
};

export const updatesRuleset: RuleSet = {
  label: "Updates",
  threshold: 0.7,
  rules: [
    {
      id: "updates/phrases",
      weight: 0.4,
      when: [{ op: "textMatch", any: marketingPhrases.update, scope: "both" }],
    },
    {
      id: "updates/status-hosts",
      weight: 0.3,
      when: [
        {
          op: "linkHostIn",
          any: [
            "statuspage.io",
            "status.atlassian.com",
            "status.aws.amazon.com",
            "status.azure.com",
            "status.openai.com",
            "status.twilio.com",
            "status.slack.com",
            "developer.apple.com",
          ],
        },
      ],
    },
    {
      id: "updates/listid-or-unsubscribe",
      weight: 0.15,
      when: [
        { op: "flagTrue", key: "hasListId" },
        { op: "flagTrue", key: "hasUnsubscribe" },
      ],
    },
  ],
};
