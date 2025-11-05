import { NextRequest, NextResponse } from "next/server";

import { pollInboxDelta } from "@/lib/delta";
import { resetDeltaState } from "@/lib/devDeltaStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensure no caching

type PollDeltaResult = {
  count?: number;
  since?: string | null;
  until?: string | null;
  mailbox?: string | null;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cron-token");
  if (!token || token !== process.env.CRON_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Run your actual poll
    const result = (await pollInboxDelta()) as PollDeltaResult | undefined;

    // Build and log a useful summary
    const summary = {
      ok: true,
      fetched: result?.count ?? 0,
      since: result?.since ?? null,
      until: result?.until ?? null,
      mailbox: result?.mailbox ?? "unknown",
      timestamp: new Date().toISOString(),
    };
    console.log("[poll]", JSON.stringify(summary));

    // Return it in the HTTP response too
    return NextResponse.json(summary);
  } catch (e: unknown) {
    let message: string;
    if (e instanceof Error) {
      message = e.message;
    } else if (typeof e === "string") {
      message = e;
    } else {
      message = "unknown error";
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Dev-only reset: /api/poll?reset=1
  const url = new URL(req.url);
  if (
    process.env.NODE_ENV !== "production" &&
    url.searchParams.get("reset") === "1"
  ) {
    resetDeltaState();
    const resetSummary = {
      ok: true,
      reset: true,
      timestamp: new Date().toISOString(),
    } as const;
    console.log("[poll]", JSON.stringify(resetSummary));
    return NextResponse.json(resetSummary);
  }

  // In production, require the x-cron-token header; in dev, allow unauthenticated GET
  const token = req.headers.get("x-cron-token");
  if (process.env.NODE_ENV === "production") {
    if (!token || token !== process.env.CRON_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  try {
    const result = (await pollInboxDelta()) as PollDeltaResult | undefined;

    const summary = {
      ok: true,
      fetched: result?.count ?? 0,
      since: result?.since ?? null,
      until: result?.until ?? null,
      mailbox: result?.mailbox ?? "unknown",
      timestamp: new Date().toISOString(),
    };

    console.log("[poll]", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (e: unknown) {
    let message: string;
    if (e instanceof Error) message = e.message;
    else if (typeof e === "string") message = e;
    else message = "unknown error";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
