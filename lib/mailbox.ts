// lib/mailbox.ts
function isAppOnlyToken(jwt: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8"),
    );
    return !!payload.roles && !payload.scp;
  } catch {
    return false;
  }
}

function decodeUpnLike(jwt: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8"),
    );
    return (
      payload.upn ||
      payload.preferred_username ||
      payload.unique_name ||
      payload.email ||
      null
    );
  } catch {
    return null;
  }
}

function resolveMailboxAddresses(resolvedUpn: string | null) {
  const extraSelfEmails =
    process.env.SELF_EMAILS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return Array.from(
    new Set(
      [resolvedUpn, process.env.MAILBOX_UPN, ...extraSelfEmails].filter(
        (addr): addr is string => Boolean(addr),
      ),
    ),
  );
}

export function resolveMailboxContext(accessToken: string) {
  const appOnly = isAppOnlyToken(accessToken);
  const tokenUpn = decodeUpnLike(accessToken);

  const resolvedUpn =
    process.env.MAILBOX_UPN || (!appOnly ? tokenUpn || null : null);

  const root = appOnly
    ? (() => {
        const explicit = process.env.MAILBOX_UPN || resolvedUpn;
        if (!explicit)
          throw new Error(
            "MAILBOX_UPN is required for app-only tokens (no user in token); set MAILBOX_UPN to the target mailbox UPN",
          );
        return `/users('${explicit}')`;
      })()
    : `/me`;

  const mailboxAddresses = resolveMailboxAddresses(resolvedUpn);

  return { appOnly, resolvedUpn, root, mailboxAddresses };
}
