import {
  decryptSharePointToken,
  encryptSharePointToken,
  refreshSharePointAccessToken
} from "@/lib/sharepoint";
import {
  getActiveSharePointConnection,
  updateSharePointConnectionTokens
} from "@/lib/data";

function tokenExpiresSoon(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return true;
  }

  return date.getTime() < Date.now() + 2 * 60 * 1000;
}

export async function getSharePointConnectionWithAccessToken(input) {
  const connection = await getActiveSharePointConnection(input);
  if (!connection) {
    throw new Error("SharePoint is not connected for this workspace.");
  }

  let accessToken = decryptSharePointToken(connection.encryptedAccessToken);
  if (!accessToken || tokenExpiresSoon(connection.accessTokenExpiresAt)) {
    const refreshToken = decryptSharePointToken(connection.encryptedRefreshToken);
    if (!refreshToken) {
      throw new Error("SharePoint needs to be reconnected.");
    }

    const refreshed = await refreshSharePointAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    const updated = await updateSharePointConnectionTokens({
      id: connection.id,
      encryptedAccessToken: encryptSharePointToken(refreshed.access_token),
      encryptedRefreshToken: refreshed.refresh_token ? encryptSharePointToken(refreshed.refresh_token) : "",
      accessTokenExpiresAt: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000),
      scope: refreshed.scope || connection.scope
    });

    return {
      connection: updated || connection,
      accessToken
    };
  }

  return {
    connection,
    accessToken
  };
}

export function summarizeSharePointConnection(connection) {
  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    provider: "sharepoint",
    workspaceSlug: connection.workspaceSlug,
    microsoftAccountEmail: connection.microsoftAccountEmail,
    microsoftDisplayName: connection.microsoftDisplayName,
    status: connection.status,
    updatedAt: connection.updatedAt
  };
}
