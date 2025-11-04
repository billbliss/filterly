import { NextResponse } from "next/server";

import { pollInboxDelta } from "@/lib/delta";

export const runtime = "nodejs";
export async function GET() {
  try {
    await pollInboxDelta();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
