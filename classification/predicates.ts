// classification/predicates.ts
export const phrases = {
  donate: [
    /(?:\b|^)donate\b/i,
    /\bchip in\b/i,
    /\bpitch in\b/i,
    /\bsplit a donation\b/i,
    /\brush \$?\d+/i,
    /\bend[- ]of[- ](month|quarter|year)\b/i,
    /\bpetition\b/i,
    /\bsign (?:the )?petition\b/i,
    /\bvote[- ]by[- ]mail\b/i,
    /\bballot\b/i,
    /\bdefeat (?:maga|trump)\b/i,
  ],
  politicalFooter: [/\bpaid for by\b/i, /\bFEC\b/i],
  phishingUrgency: [
    /\bverify (your )?account\b/i,
    /\bpassword (expires|reset)\b/i,
    /\bunusual login\b/i,
    /\baccount (suspend|suspended)\b/i,
    /\bpayment overdue\b/i,
  ],
  brandSpoof: [
    /\b(microsoft|apple|paypal|bank of america|chase|wells fargo)\b/i,
  ],
  office365Mention: [
    /\boffice ?365\b/i,
    /\bmicrosoft ?365\b/i,
    /\bmicrosoft subscription\b/i,
    /\bmicrosoft account\b/i,
  ],
  office365Urgency: [
    /\bavoid (?:service )?interruption\b/i,
    /\bsubscription payment due\b/i,
    /\baction required\b/i,
    /\bresolve (?:account|issue)\b/i,
    /\breview (?:issue|account|subscription)\b/i,
    /\bsecurity (?:alert|review)\b/i,
  ],
};
