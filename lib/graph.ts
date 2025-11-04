import { Client } from "@microsoft/microsoft-graph-client";

import { getAccessToken } from "./msal";

export async function graphClient() {
  const token = await getAccessToken();
  return Client.init({ authProvider: (done) => done(null, token) });
}
