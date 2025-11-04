// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

import { msalApp } from "@/lib/msal";

export async function GET(request: Request) {
  // 1) Clear MSAL cached accounts (local sign-out)
  try {
    const cache = msalApp.getTokenCache();
    const accounts = await cache.getAllAccounts();
    await Promise.all(accounts.map((a) => cache.removeAccount(a)));
  } catch (err) {
    console.error("[logout] failed to clear MSAL cache:", err);
  }

  // 2) Redirect to Microsoft logout with a return URL to your app
  const { origin } = new URL(request.url);
  const tenant = process.env.TENANT_ID || "common";
  const postLogout = `${origin}/`; // or `${origin}/logged-out` if you have a page
  const msLogout = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout`
  );
  msLogout.searchParams.set("post_logout_redirect_uri", postLogout);

  const res = NextResponse.redirect(msLogout.toString(), 302);

  // 3) (Optional) Proactively clear any app cookies you use
  for (const name of ["auth", "session", "msal"]) {
    res.cookies.set({ name, value: "", maxAge: 0, path: "/" });
  }

  return res;
}
