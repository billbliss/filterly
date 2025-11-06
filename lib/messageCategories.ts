// lib/messageCategories.ts
import { type Classified } from "@/classification/classify.js";

import { graphClient } from "./graph.js";

const APPLY_CATEGORIES = process.env.APPLY_CATEGORIES !== "0";
const CATEGORY_PREFIX = process.env.CATEGORY_PREFIX || "Filterly";
const CATEGORY_COLOR = process.env.CATEGORY_COLOR || "preset0";
const CATEGORY_LIMIT = 25;
const filterlyPrefixLower = `${CATEGORY_PREFIX.toLowerCase()}:`;

const masterCategoryCache = new Map<string, Set<string>>();

type GraphClient = Awaited<ReturnType<typeof graphClient>>;

function masterCategoriesPath(root: string) {
  return root === "/me"
    ? "/me/outlook/masterCategories"
    : `${root}/outlook/masterCategories`;
}

async function ensureMasterCategories(
  client: GraphClient,
  root: string,
  categories: string[],
) {
  if (!categories.length) return;

  const path = masterCategoriesPath(root);

  let known = masterCategoryCache.get(path);
  if (!known) {
    const res = await client.api(path).top(100).get();
    const entries =
      (res?.value as Array<{ displayName?: string }> | undefined) ?? [];
    known = new Set(
      entries
        .map((c) => c.displayName)
        .filter((name): name is string => Boolean(name)),
    );
    masterCategoryCache.set(path, known);
  }

  const missing = categories.filter((name) => !known!.has(name));
  for (const displayName of missing) {
    await client
      .api(path)
      .post({ displayName, color: CATEGORY_COLOR as unknown });
    known!.add(displayName);
  }
}

function formatCategory(token: string) {
  return `${CATEGORY_PREFIX}:${token}`;
}

export function categoriesForClassification(
  classification: Classified,
): string[] {
  const categories: string[] = [];
  if (classification.primaryFolder) {
    categories.push(formatCategory(`Folder:${classification.primaryFolder}`));
  }
  if (
    classification.primaryLabel &&
    classification.primaryLabel !== "Unknown"
  ) {
    categories.push(formatCategory(`Label:${classification.primaryLabel}`));
  }

  classification.results
    .filter((r) => r.label !== classification.primaryLabel)
    .slice(0, 2)
    .forEach((r) => {
      categories.push(formatCategory(`Label:${r.label}`));
    });

  return Array.from(new Set(categories));
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

export async function applyCategoriesToMessage(
  client: GraphClient,
  root: string,
  messageId: string,
  existingCategories: string[] | undefined,
  classification: Classified,
  options?: { overwriteFilterly?: boolean; dryRun?: boolean },
) {
  if (!APPLY_CATEGORIES)
    return {
      changed: false,
      categories: existingCategories ?? [],
      previous: existingCategories ?? [],
      applied: false,
    };

  const encodedId = encodeURIComponent(messageId);
  const messagePath = `${root}/messages/${encodedId}`;
  const original = Array.isArray(existingCategories)
    ? [...existingCategories]
    : [];

  const preserved: string[] = [];
  const seen = new Set<string>();
  const shouldKeep = options?.overwriteFilterly
    ? (cat: string) => !cat.toLowerCase().startsWith(filterlyPrefixLower)
    : () => true;

  original.forEach((cat) => {
    if (!cat) return;
    if (!shouldKeep(cat)) return;
    const lower = cat.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    preserved.push(cat);
  });

  const newCategories = categoriesForClassification(classification);
  const final: string[] = [...preserved];
  newCategories.forEach((cat) => {
    const lower = cat.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    final.push(cat);
  });

  const trimmed = final.slice(0, CATEGORY_LIMIT);

  const changed = !arraysEqual(original, trimmed);
  if (!changed) {
    return {
      changed: false,
      categories: original,
      previous: original,
      applied: false,
    };
  }

  if (options?.dryRun) {
    return {
      changed: true,
      categories: trimmed,
      previous: original,
      applied: false,
    };
  }

  await ensureMasterCategories(client, root, newCategories);
  await client.api(messagePath).patch({ categories: trimmed });

  return {
    changed: true,
    categories: trimmed,
    previous: original,
    applied: true,
  };
}
