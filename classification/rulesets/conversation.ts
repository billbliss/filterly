// classification/rulesets/conversation.ts
import { RuleSet } from "../types";

export const conversationRuleset: RuleSet = {
  label: "ReplyRequested",
  threshold: 0.7,
  rules: [
    {
      id: "conversation/mentions-mailbox",
      weight: 0.5,
      when: [{ op: "flagTrue", key: "mentionsMailbox" }],
    },
    {
      id: "conversation/reply-chain",
      weight: 0.4,
      when: [{ op: "flagTrue", key: "isReplyChain" }],
    },
  ],
};
