// classification/engine.ts
import {
  DetectionEvidence,
  DetectionResult,
  MessageFeatures,
  Operand,
  RuleItem,
  RuleSet,
} from "./types";

const getHost = (url?: string) => {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
};

function textIncludes(hay: string, needle: string | RegExp): boolean {
  if (typeof needle === "string") return hay.includes(needle.toLowerCase());
  return needle.test(hay);
}

function evalOperand(f: MessageFeatures, op: Operand): boolean {
  switch (op.op) {
    case "textMatch": {
      const scope = op.scope ?? "both";
      let text = "";
      if (scope === "subject") {
        text = f.subject || "";
      } else if (scope === "body") {
        text = f.bodySample || "";
      } else {
        text = `${f.subject || ""} ${f.bodySample || ""}`;
      }
      const low = text.toLowerCase();
      return op.any.some((p) => textIncludes(low, p));
    }
    case "headerEquals": {
      const v = f.headers?.[op.header.toLowerCase()] ?? f.headers?.[op.header];
      return v
        ? op.equalsAny.some((x) => v.toLowerCase() === x.toLowerCase())
        : false;
    }
    case "flagTrue":
      return Boolean((f as unknown as Record<string, unknown>)[op.key]);
    case "replyToDomainMismatch": {
      if (!f.replyTo) return false;
      const rtDom = f.replyTo.split("@")[1]?.toLowerCase();
      const fromDom = f.fromDomain?.toLowerCase();
      if (!rtDom || !fromDom) return false;
      // allow common ESPs (Mailchimp/SendGrid) to differ without tripping
      const esp = [
        "sendgrid.net",
        "mailgun.org",
        "sparkpostmail.com",
        "amazonses.com",
      ];
      return rtDom !== fromDom && !esp.some((d) => rtDom.endsWith(d));
    }
    case "authFailed":
      return f.auth?.spfPass === false || f.auth?.dkimPass === false;
    case "attachmentExtIn":
      return (f.attachmentKinds || []).some((ext) =>
        op.any.includes(ext.toLowerCase()),
      );
    case "linkHostIn":
      return (f.links || []).some((l) => op.any.includes(getHost(l.href)));
    case "fromDomainIn": {
      const domain = f.fromDomain?.toLowerCase();
      if (!domain) return false;
      return op.any.some((d) => domain === d.toLowerCase());
    }
    case "visibleHrefHostMismatch":
      return (f.links || []).some((l) => {
        const vis = getHost(l.text);
        const href = getHost(l.href);
        return vis && href && vis !== href;
      });
    case "regex": {
      const v = (f as unknown as Record<string, unknown>)[op.field];
      if (typeof v !== "string") return false;
      return op.pattern.test(v);
    }
    default:
      return false;
  }
}

function evalRule(
  f: MessageFeatures,
  r: RuleItem,
): { fired: boolean; detail?: string } {
  const passes = r.any
    ? r.when.some((op) => evalOperand(f, op))
    : r.when.every((op) => evalOperand(f, op));
  return { fired: passes, detail: r.detail?.(f) };
}

export function runRuleSet(
  f: MessageFeatures,
  rs: RuleSet,
): DetectionResult | null {
  let score = 0;
  const evidence: DetectionEvidence[] = [];

  rs.rules.forEach((r) => {
    const { fired, detail } = evalRule(f, r);
    if (fired) {
      score += r.weight;
      evidence.push({ rule: r.id, detail });
    }
  });

  const cap = rs.hardCap ?? 1;
  score = Math.min(score, cap);

  if (score >= rs.threshold) {
    return { label: rs.label, confidence: score, evidence };
  }
  return null;
}
