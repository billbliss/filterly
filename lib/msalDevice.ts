import { PublicClientApplication, type DeviceCodeRequest } from "@azure/msal-node";

const pca = new PublicClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
});

export async function getDeviceToken() {
  const request: DeviceCodeRequest = {
    scopes: ["Mail.Read"],
    deviceCodeCallback: (info) => console.log(info.message),
  };
  const result = await pca.acquireTokenByDeviceCode(request);
  if (!result?.accessToken) throw new Error("No access token");
  return result.accessToken;
}