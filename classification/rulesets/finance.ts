// classification/rulesets/finance.ts
import { RuleSet } from "../types";

const financePhrases = {
  receipt: [
    /\breceipt\b/i,
    /\bthanks for (your )?purchase\b/i,
    /\bpayment (received|processed)\b/i,
    /\bcharged\b/i,
    /\border (confirmation|number)\b/i,
    /\binvoice\b/i,
    /\bbilled\b/i,
  ],
  statement: [
    /\b(monthly )?statement\b/i,
    /\bamount due\b/i,
    /\bminimum payment\b/i,
    /\bdue date\b/i,
    /\bautopay\b/i,
    /\btransaction alert\b/i,
    /\bzelle\b/i,
    /\bpayment (?:has been |was )?(?:deposited|sent|received)\b/i,
    /\brecurring payment\b/i,
    /\bvote[- ]now\b/i,
    /\bproxy vote\b/i,
  ],
  orderShip: [
    /\b(order|shipment|shipping|delivery|tracking)\b/i,
    /\bout for delivery\b/i,
    /\barriving\b/i,
    /\bdelivered\b/i,
    /\binvoice\b/i,
    /\border confirmation\b/i,
    /\buber (?:trip|ride|receipt)\b/i,
    /\byour (?:morning|afternoon|evening)?\s*trip\b/i,
    /\bride summary\b/i,
  ],
};

const financeSenderDomains = [
  "notifications.usbank.com",
  "customercenter.net",
  "venmo.com",
  "billing.garmin.com",
  "shareholderdocs.fidelity.com",
  "proxyvote.com",
  "getinvoicesimple.com",
  "desertluxuryconcierge.com",
  "wi-q.com",
  "icapitalnetwork.com",
  "paythepoolman.com",
];

const orderSenderDomains = [
  "amazon.com",
  "orders.wi-q.com",
  "zappos.com",
  "uber.com",
  "getinvoicesimple.com",
  "desertluxuryconcierge.com",
];

export const receiptsRuleset: RuleSet = {
  label: "Receipts",
  threshold: 0.7,
  rules: [
    {
      id: "receipt/keywords",
      weight: 0.35,
      when: [{ op: "textMatch", any: financePhrases.receipt, scope: "both" }],
    },
    {
      id: "receipt/pdf-attach",
      weight: 0.25,
      when: [{ op: "attachmentExtIn", any: ["pdf"] }],
    },
    {
      id: "receipt/amount-regex",
      weight: 0.2,
      when: [
        {
          op: "regex",
          field: "bodySample",
          pattern: /\$\s?\d{1,3}(?:[,\d]{0,3})?(?:\.\d{2})?/,
        },
      ],
    },
    {
      id: "receipt/unsubscribe-or-listid",
      weight: 0.15,
      when: [
        { op: "flagTrue", key: "hasUnsubscribe" },
        { op: "flagTrue", key: "hasListId" },
      ],
    },
  ],
};

export const financeRuleset: RuleSet = {
  label: "FinanceBilling",
  threshold: 0.55,
  rules: [
    {
      id: "finance/statement",
      weight: 0.35,
      when: [{ op: "textMatch", any: financePhrases.statement, scope: "both" }],
    },
    {
      id: "finance/from-domains",
      weight: 0.5,
      when: [{ op: "fromDomainIn", any: financeSenderDomains }],
    },
    {
      id: "finance/pdf-attach",
      weight: 0.15,
      when: [{ op: "attachmentExtIn", any: ["pdf"] }],
    },
    {
      id: "finance/bankish-domains",
      weight: 0.2,
      when: [
        {
          op: "linkHostIn",
          any: [
            "secure.bankofamerica.com",
            "chase.com",
            "wellsfargo.com",
            "americanexpress.com",
            "capitalone.com",
            "citibank.com",
            "paypal.com",
          ],
        },
      ],
    },
    {
      id: "finance/unsubscribe-or-listid",
      weight: 0.1,
      when: [
        { op: "flagTrue", key: "hasUnsubscribe" },
        { op: "flagTrue", key: "hasListId" },
      ],
    },
  ],
};

export const ordersShippingRuleset: RuleSet = {
  label: "OrdersShipping",
  threshold: 0.6,
  rules: [
    {
      id: "orders/keywords",
      weight: 0.35,
      when: [{ op: "textMatch", any: financePhrases.orderShip, scope: "both" }],
    },
    {
      id: "orders/tracking-hosts",
      weight: 0.3,
      when: [
        {
          op: "linkHostIn",
          any: [
            "ups.com",
            "tools.usps.com",
            "fedex.com",
            "dhl.com",
            "amazon.com",
          ],
        },
      ],
    },
    {
      id: "orders/from-domains",
      weight: 0.35,
      when: [{ op: "fromDomainIn", any: orderSenderDomains }],
    },
    {
      id: "orders/tracking-regex",
      weight: 0.2,
      when: [
        {
          op: "regex",
          field: "bodySample",
          pattern: /\b(tracking|track|tn|waybill)[\s:]*[#-]?\s?[A-Z0-9]{8,}\b/i,
        },
      ],
    },
    {
      id: "orders/unsubscribe-or-listid",
      weight: 0.15,
      when: [
        { op: "flagTrue", key: "hasUnsubscribe" },
        { op: "flagTrue", key: "hasListId" },
      ],
    },
  ],
};
