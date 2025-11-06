// classification/rulesets/travel.ts
import { RuleSet } from "../types.js";

const travelPhrases = {
  flight: [
    /\b(itinerary|e[- ]ticket|boarding pass)\b/i,
    /\bflight\b/i,
    /\bPNR\b/i,
    /\bconfirmation\b/i,
    /\bdepart(s|ure)?\b/i,
    /\barriv(es|al)?\b/i,
    /\b[A-Z]{2}\d{2,4}\b/, // airline codes like AA123, DL2456
  ],
  hotel: [
    /\b(reservation|booking|check[- ]in|check[- ]out)\b/i,
    /\bconfirmation\b/i,
    /\broom\b/i,
    /\brate\b/i,
  ],
  car: [/\bcar (rental|hire)\b/i, /\bpickup\b/i, /\bdrop[- ]off\b/i],
};

export const travelRuleset: RuleSet = {
  label: "Travel",
  threshold: 0.7,
  rules: [
    {
      id: "travel/airline-hosts",
      weight: 0.35,
      when: [
        {
          op: "linkHostIn",
          any: [
            "aa.com",
            "delta.com",
            "united.com",
            "alaskaair.com",
            "jetblue.com",
            "southwest.com",
            "ba.com",
            "aircanada.com",
            "lufthansa.com",
            "jal.co.jp",
            "ana.co.jp",
          ],
        },
      ],
    },
    {
      id: "travel/flight-phrases",
      weight: 0.3,
      when: [{ op: "textMatch", any: travelPhrases.flight, scope: "both" }],
    },
    {
      id: "travel/hotel-car-phrases",
      weight: 0.2,
      when: [
        {
          op: "textMatch",
          any: [...travelPhrases.hotel, ...travelPhrases.car],
          scope: "both",
        },
      ],
    },
    {
      id: "travel/ota-hosts",
      weight: 0.2,
      when: [
        {
          op: "linkHostIn",
          any: [
            "booking.com",
            "expedia.com",
            "airbnb.com",
            "hotels.com",
            "trip.com",
            "agoda.com",
            "kayak.com",
          ],
        },
      ],
    },
  ],
};

export const calendarItineraryRuleset: RuleSet = {
  label: "CalendarItinerary",
  threshold: 0.7,
  rules: [
    {
      id: "cal/ics-attach",
      weight: 0.45,
      when: [{ op: "attachmentExtIn", any: ["ics"] }],
    },
    {
      id: "cal/meeting-phrases",
      weight: 0.3,
      when: [
        {
          op: "textMatch",
          any: [
            /\b(invite|invitation|meeting|rescheduled|canceled|accepted|declined)\b/i,
            /\bzoom|teams|meet\.google\.com|webex\b/i,
          ],
          scope: "both",
        },
      ],
    },
    {
      id: "cal/listid-or-unsubscribe",
      weight: 0.1,
      when: [
        { op: "flagTrue", key: "hasListId" },
        { op: "flagTrue", key: "hasUnsubscribe" },
      ],
    },
  ],
};
