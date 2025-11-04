import { NextResponse } from "next/server";

import { getAuthUrl } from "@/lib/msal";

export async function GET() {
  const url = await getAuthUrl();
  return NextResponse.redirect(url, 302);
}
