import {
  ConfidentialClientApplication,
  type DeviceCodeRequest,
  LogLevel,
  PublicClientApplication,
} from "@azure/msal-node";

import { kvGet, kvSet } from "./kv";

const getAuthority = () =>
  `https://login.microsoftonline.com/${process.env.TENANT_ID || "common"}`;

const CACHE_KEY = (suffix: string) => `msal-cache:${suffix}`;
const CACHE_TENANT = process.env.TENANT_ID || "common";
const CACHE_CLIENT = process.env.CLIENT_ID || "unknown-client";
const CACHE_MODE = process.env.AUTH_MODE || "auto";
const MSAL_CACHE = CACHE_KEY(`${CACHE_CLIENT}:${CACHE_TENANT}:${CACHE_MODE}`);
export const scopes = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
];

const appOnlyScopes = ["https://graph.microsoft.com/.default"];
const { AUTH_MODE } = process.env; // 'app' | 'device' | undefined

export const msalApp = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    authority: getAuthority(),
  },
  system: {
    loggerOptions: { logLevel: LogLevel.Warning, piiLoggingEnabled: false },
  },
  cache: {
    cachePlugin: {
      beforeCacheAccess: async (ctx) => {
        const blob = await kvGet<string>(MSAL_CACHE);
        if (blob) ctx.tokenCache.deserialize(blob);
      },
      afterCacheAccess: async (ctx) => {
        if (ctx.cacheHasChanged)
          await kvSet(MSAL_CACHE, ctx.tokenCache.serialize());
      },
    },
  },
});

// Public client for Device Code flow (delegated) – used locally when no secret is present
const pca = new PublicClientApplication({
  auth: {
    clientId: process.env.CLIENT_ID!,
    authority: getAuthority(),
  },
  system: {
    loggerOptions: { logLevel: LogLevel.Warning, piiLoggingEnabled: false },
  },
  cache: {
    cachePlugin: {
      beforeCacheAccess: async (ctx) => {
        const blob = await kvGet<string>(`${MSAL_CACHE}:pca`);
        if (blob) ctx.tokenCache.deserialize(blob);
      },
      afterCacheAccess: async (ctx) => {
        if (ctx.cacheHasChanged)
          await kvSet(`${MSAL_CACHE}:pca`, ctx.tokenCache.serialize());
      },
    },
  },
});

async function getAppOnlyToken() {
  const result = await msalApp.acquireTokenByClientCredential({
    scopes: appOnlyScopes,
  });
  if (!result?.accessToken) throw new Error("No access token (app-only)");
  return result.accessToken;
}

async function getDeviceCodeToken() {
  const request: DeviceCodeRequest = {
    scopes,
    deviceCodeCallback: (info) => console.log(info.message),
  };
  const result = await pca.acquireTokenByDeviceCode(request);
  if (!result?.accessToken) throw new Error("No access token (device code)");
  return result.accessToken;
}

export function getAuthUrl() {
  return msalApp.getAuthCodeUrl({
    scopes,
    redirectUri: process.env.REDIRECT_URI!,
    prompt: "select_account",
    loginHint: process.env.USER_HINT,
  });
}

export async function acquireTokenByCode(code: string) {
  return msalApp.acquireTokenByCode({
    code,
    scopes,
    redirectUri: process.env.REDIRECT_URI!,
  });
}

export async function getAccessToken() {
  // 1) Explicit mode overrides take precedence
  if (AUTH_MODE === "device") {
    // Try silent delegated first via PCA cache
    const pcaCache = pca.getTokenCache();
    const pcaAccounts = await pcaCache.getAllAccounts();
    if (pcaAccounts.length) {
      const res = await pca.acquireTokenSilent({
        account: pcaAccounts[0],
        scopes,
      });
      return res!.accessToken;
    }
    // Fallback to interactive device code
    return getDeviceCodeToken();
  }
  if (AUTH_MODE === "app") {
    if (!process.env.CLIENT_SECRET)
      throw new Error("AUTH_MODE=app but CLIENT_SECRET is not set");
    return getAppOnlyToken();
  }

  // 2) Auto mode: prefer delegated if available in PCA cache
  const pcaCache = pca.getTokenCache();
  const pcaAccounts = await pcaCache.getAllAccounts();
  if (pcaAccounts.length) {
    const res = await pca.acquireTokenSilent({
      account: pcaAccounts[0],
      scopes,
    });
    return res!.accessToken;
  }

  // 3) Otherwise try confidential client silent (if you previously used auth code)
  const ccaAccounts = await msalApp.getTokenCache().getAllAccounts();
  if (ccaAccounts.length) {
    const res = await msalApp.acquireTokenSilent({
      account: ccaAccounts[0],
      scopes,
    });
    return res!.accessToken;
  }

  // 4) If a secret is present, assume server/cron context → app-only
  if (process.env.CLIENT_SECRET) {
    return getAppOnlyToken();
  }

  // 5) Fallback to device code for local dev
  return getDeviceCodeToken();
}
