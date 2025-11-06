import { NextResponse } from "next/server";

import { acquireTokenByCode } from "@/lib/msal";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });
  try {
    await acquireTokenByCode(code);
    return new NextResponse(
      "Signed in! Polling is ready. You can close this tab.",
    );
  } catch (e: any) {
    return new NextResponse(`Auth error: ${e.message}`, { status: 500 });
  }
}
