// lib/mailFolders.ts
import { graphClient } from "./graph.js";

const MOVE_ENABLED =
  typeof process.env.MOVE_ENABLED === "string" &&
  process.env.MOVE_ENABLED.toLowerCase() === "true";

type GraphClient = Awaited<ReturnType<typeof graphClient>>;

interface MailFolder {
  id?: string;
  displayName?: string;
}

const folderCache = new Map<string, Map<string, string>>();
const loadedRoots = new Set<string>();

function inboxChildPath(root: string) {
  const base =
    root === "/me"
      ? "/me/mailFolders('Inbox')"
      : `${root}/mailFolders('Inbox')`;
  return `${base}/childFolders`;
}

async function loadChildFolders(client: GraphClient, root: string) {
  if (loadedRoots.has(root)) return;
  const path = inboxChildPath(root);
  const res = await client.api(path).select("id,displayName").top(200).get();
  const items: MailFolder[] = Array.isArray(res.value) ? res.value : [];
  const map = folderCache.get(root) ?? new Map<string, string>();
  items.forEach((item: MailFolder) => {
    if (item?.id && item?.displayName) {
      map.set(item.displayName.toLowerCase(), item.id);
    }
  });
  folderCache.set(root, map);
  loadedRoots.add(root);
}

async function getFolderId(
  client: GraphClient,
  root: string,
  displayName: string,
  createIfMissing: boolean,
) {
  await loadChildFolders(client, root);
  const map = folderCache.get(root) ?? new Map<string, string>();
  folderCache.set(root, map);

  const key = displayName.toLowerCase();
  const existing = map.get(key);
  if (existing) return existing;

  if (!createIfMissing) return null;

  const path = inboxChildPath(root);
  const created = await client.api(path).post({ displayName });
  if (created?.id) {
    map.set(key, created.id);
    return created.id;
  }
  return null;
}

type MoveOptions = { dryRun?: boolean };

export async function moveMessageToFolder(
  client: GraphClient,
  root: string,
  messageId: string,
  currentFolderId: string | undefined | null,
  targetFolderName: string | null | undefined,
  options: MoveOptions = {},
) {
  if (!targetFolderName || !targetFolderName.trim()) {
    return { action: "no-target" as const };
  }

  const normalizedName = targetFolderName.trim();
  const shouldCreate = MOVE_ENABLED && !options.dryRun;
  const targetFolderId = await getFolderId(
    client,
    root,
    normalizedName,
    shouldCreate,
  );

  if (!targetFolderId) {
    return {
      action: "missing-folder" as const,
      targetFolderName: normalizedName,
    };
  }

  if (currentFolderId && currentFolderId === targetFolderId) {
    return {
      action: "already" as const,
      targetFolderId,
      targetFolderName: normalizedName,
    };
  }

  if (options.dryRun) {
    return {
      action: "dry-run" as const,
      targetFolderId,
      targetFolderName: normalizedName,
      moveEnabled: MOVE_ENABLED,
    };
  }

  if (!MOVE_ENABLED) {
    return {
      action: "disabled" as const,
      targetFolderId,
      targetFolderName: normalizedName,
    };
  }

  const encodedId = encodeURIComponent(messageId);
  const movePath = `${root}/messages/${encodedId}/move`;
  await client.api(movePath).post({ destinationId: targetFolderId });

  return {
    action: "moved" as const,
    targetFolderId,
    targetFolderName: normalizedName,
  };
}

export function isMoveEnabled() {
  return MOVE_ENABLED;
}
