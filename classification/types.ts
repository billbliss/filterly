// classification/types.ts
export interface MessageFeatures {
  id: string;
  subject: string;
  bodySample: string;
  from: string;
  fromDomain: string;
  replyTo?: string;
  hasListId?: boolean;
  hasUnsubscribe?: boolean;
  mentionsMailbox?: boolean;
  isReplyChain?: boolean;
  hasInReplyTo?: boolean;
  attachmentKinds?: string[]; // ["pdf","ics","html",...]
  links?: { text?: string; href?: string }[];
  headers?: Record<string, string | undefined>;
  auth?: { spfPass?: boolean; dkimPass?: boolean; arcPass?: boolean };
}

export interface DetectionEvidence {
  rule: string;
  detail?: string;
}

export interface DetectionResult {
  label: string;
  confidence: number;
  evidence: DetectionEvidence[];
  moveEnabled: boolean;
}

export type Operand =
  | {
      op: "textMatch";
      any: (string | RegExp)[];
      scope?: "subject" | "body" | "both";
    }
  | { op: "headerEquals"; header: string; equalsAny: string[] }
  | { op: "flagTrue"; key: keyof MessageFeatures } // e.g., hasUnsubscribe
  | { op: "replyToDomainMismatch" }
  | { op: "authFailed" } // SPF or DKIM fail
  | { op: "attachmentExtIn"; any: string[] }
  | { op: "linkHostIn"; any: string[] }
  | { op: "fromDomainIn"; any: string[] }
  | { op: "visibleHrefHostMismatch" } // compares link text host vs href host
  | { op: "regex"; field: keyof MessageFeatures; pattern: RegExp };

export interface RuleItem {
  id: string;
  weight: number; // contribution to score (0–1)
  when: Operand[];
  any?: boolean; // default: all operands must pass; if true: any can pass
  detail?: (f: MessageFeatures) => string | undefined;
}

export interface RuleSet {
  label: string; // output label if score >= threshold
  threshold: number; // e.g., 0.7
  hardCap?: number; // optional cap, default 1
  moveEnabled?: boolean; // whether hits from this ruleset allow moving
  rules: RuleItem[];
}
