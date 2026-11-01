import type { ChatSource, LlmAccount } from "./types";

const LLM_KEY_SEP = "\u001f";

export function llmModelKey(accountId: string, model: string) {
  return `${accountId}${LLM_KEY_SEP}${model}`;
}

export function parseLlmModelKey(key: string): { accountId: string; model: string } | null {
  const i = key.indexOf(LLM_KEY_SEP);
  if (i <= 0) return null;
  const model = key.slice(i + LLM_KEY_SEP.length);
  if (!model) return null;
  return { accountId: key.slice(0, i), model };
}

export function llmModelName(key: string) {
  return parseLlmModelKey(key)?.model ?? key;
}

export function isMultiLlm(activeIds?: string[]) {
  return (activeIds?.length ?? 0) > 1;
}

export function llmModelLabel(key: string, accounts: LlmAccount[], catalog: string[]) {
  const name = llmModelName(key);
  const parsed = parseLlmModelKey(key);
  if (!parsed) return name;
  const dups = catalog.filter((id) => llmModelName(id) === name);
  if (dups.length < 2) return name;
  const acc = accounts.find((a) => a.id === parsed.accountId);
  return acc?.name ? `${name} · ${acc.name}` : name;
}

export function catalogFromLinks(links: { account: LlmAccount; models: string[] }[], prefer?: string) {
  const llmModels: string[] = [];
  const llmStarred: string[] = [];
  for (const link of links) {
    const stars = new Set(link.account.starred ?? []);
    for (const model of link.models) {
      const key = llmModelKey(link.account.id, model);
      if (!llmModels.includes(key)) llmModels.push(key);
      if (stars.has(model)) llmStarred.push(key);
    }
  }
  const llmModel = prefer && llmModels.includes(prefer) ? prefer : llmStarred[0] || llmModels[0] || "";
  return { llmModels, llmStarred, llmModel };
}

export function resolveLlmSend(
  s: { llmBase: string; llmKey: string; llmAccounts?: LlmAccount[]; llmModels?: string[] },
  modelKey: string,
  baseOverride = "",
  keyOverride = "",
) {
  if (baseOverride && keyOverride) {
    return { baseUrl: baseOverride, apiKey: keyOverride, model: llmModelName(modelKey) };
  }
  const accounts = s.llmAccounts ?? [];
  const parsed = parseLlmModelKey(modelKey);
  if (parsed) {
    const acc = accounts.find((a) => a.id === parsed.accountId);
    if (acc) return { baseUrl: acc.base, apiKey: acc.key, model: parsed.model };
  }
  for (const id of s.llmModels ?? []) {
    const row = parseLlmModelKey(id);
    if (!row || row.model !== modelKey) continue;
    const acc = accounts.find((a) => a.id === row.accountId);
    if (acc) return { baseUrl: acc.base, apiKey: acc.key, model: row.model };
  }
  return { baseUrl: s.llmBase, apiKey: s.llmKey, model: llmModelName(modelKey) };
}

/** Chat top-bar: current pick, then starred models that are still listed. */
export function chatPickerModels(starred: string[], available: string[], current: string): string[] {
  const avail = new Set(available);
  const ids: string[] = [];
  if (current) ids.push(current);
  for (const id of starred) {
    if (avail.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Drop stars that left the catalog. Keep `current` if it is still the active pick. */
export function pruneStarred(starred: string[], available: string[], current?: string): string[] {
  const avail = new Set(available);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of starred) {
    if (!id || seen.has(id)) continue;
    if (avail.has(id) || id === current) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function snapshotLlmAccount(
  accounts: LlmAccount[],
  base: string,
  key: string,
  starred: string[],
  model: string,
): LlmAccount[] {
  const b = base.trim();
  if (!b && !key) return accounts;
  return accounts.map((a) =>
    a.base.trim() === b && a.key === key ? { ...a, starred: [...starred], model } : a,
  );
}

export function applyLlmPick(
  s: {
    llmModels: string[];
    llmStarred: string[];
    llmAccounts?: LlmAccount[];
    llmBase: string;
    llmKey: string;
  },
  id: string,
): {
  llmModel: string;
  llmStarred: string[];
  chatSource: ChatSource;
  llmAccounts: LlmAccount[];
} {
  const keep = s.llmModels.includes(id) ? undefined : id;
  const llmStarred = pruneStarred(s.llmStarred, s.llmModels, keep);
  const parsed = parseLlmModelKey(id);
  const llmAccounts = parsed
    ? (s.llmAccounts ?? []).map((a) => (a.id === parsed.accountId ? { ...a, model: parsed.model } : a))
    : snapshotLlmAccount(s.llmAccounts ?? [], s.llmBase, s.llmKey, llmStarred, id);
  return {
    llmModel: id,
    llmStarred,
    chatSource: "api" as ChatSource,
    llmAccounts,
  };
}
