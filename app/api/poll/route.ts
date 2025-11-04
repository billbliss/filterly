import { NextRequest, NextResponse } from "next/server";

import { pollInboxDelta } from "@/lib/delta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensure no caching

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cron-token");
  if (!token || token !== process.env.CRON_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    await pollInboxDelta();
    return NextResponse.json({ ok: true });
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
