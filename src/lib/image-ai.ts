import { GROK_MODELS, shortModelLabel } from "./constants.ts";
import { chatPickerModels, llmModelName } from "./llm-models.ts";
import type { ChatSource, GrokModelId } from "./types.ts";

export const FOLLOW_IMAGE_AI = "__follow__";
export const IMAGE_HDR_GROK = "__hdr_grok__";
export const IMAGE_HDR_API = "__hdr_api__";

export type ImagePickerRow = {
  id: string;
  header?: "Grok" | "API";
  danger?: boolean;
};

export function llmIdentity(base: string, key: string) {
  return `${base.trim()}\n${key}`;
}

export function isGrokModelId(id: string) {
  return GROK_MODELS.some((m) => m.id === id);
}

function isGrokish(id: string) {
  return isGrokModelId(id) || id.startsWith("grok-");
}

export function imageAiLabel(id: string) {
  if (!id || id === FOLLOW_IMAGE_AI) return "与聊天一致";
  const g = GROK_MODELS.find((m) => m.id === id);
  if (g) return g.short;
  return shortModelLabel(llmModelName(id));
}

function grokList() {
  return GROK_MODELS.map((m) => m.id);
}

function pushOpt(rows: ImagePickerRow[], seen: Set<string>, id: string, danger = false) {
  if (!id || seen.has(id)) return;
  seen.add(id);
  rows.push(danger ? { id, danger: true } : { id });
}

export function imagePickerModels(input: {
  chatSource: ChatSource;
  llmStarred: string[];
  llmModels: string[];
  llmModel: string;
  llmConnected?: boolean;
  imageModelId?: string | null;
}): ImagePickerRow[] {
  const grok = grokList();
  const grokSet = new Set<string>(grok);
  const apiOn = Boolean(input.llmConnected);
  const api = apiOn ? chatPickerModels(input.llmStarred, input.llmModels, input.llmModel) : [];
  const apiSet = new Set(api);
  const catalog = new Set(input.llmModels);
  const pick = input.imageModelId || "";
  const leftover = pick && pick !== FOLLOW_IMAGE_AI && !grokSet.has(pick) && !apiSet.has(pick) ? pick : "";
  const extraGrok = leftover && isGrokish(leftover) ? leftover : "";
  const extraApi = leftover && !isGrokish(leftover) ? leftover : "";
  const apiDanger = Boolean(extraApi && (!apiOn || !catalog.has(extraApi)));
  const grokDanger = Boolean(extraGrok && !grokSet.has(extraGrok));

  const rows: ImagePickerRow[] = [];
  const seen = new Set<string>();
  pushOpt(rows, seen, FOLLOW_IMAGE_AI);

  const appendGrok = (headed: boolean) => {
    const list = extraGrok ? [...grok, extraGrok] : grok;
    if (headed) rows.push({ id: IMAGE_HDR_GROK, header: "Grok" });
    for (const id of list) pushOpt(rows, seen, id, id === extraGrok && grokDanger);
  };
  const appendApi = (headed: boolean) => {
    const list = extraApi ? [...api, extraApi] : api;
    if (!list.length) return;
    if (headed) rows.push({ id: IMAGE_HDR_API, header: "API" });
    for (const id of list) pushOpt(rows, seen, id, id === extraApi && apiDanger);
  };

  if (input.chatSource === "api") {
    appendApi(false);
    appendGrok(true);
  } else {
    appendGrok(false);
    appendApi(true);
  }
  return rows;
}

export function applyImageAiPick(
  current: { imageModelId?: string | null; imageModelPin?: string | null },
  pick: string,
): { imageModelId: string | null; imageModelPin: string | null } {
  const pin = current.imageModelPin || null;
  if (!pick || pick === FOLLOW_IMAGE_AI) return { imageModelId: null, imageModelPin: pin };
  return {
    imageModelId: pick,
    imageModelPin: isGrokModelId(pick) ? pin : pick,
  };
}

export function imageWriteFields(imageModelId?: string | null): Record<string, unknown> {
  const dest = resolveImageWrite(imageModelId);
  if (!dest.split) return {};
  if (dest.via === "grok") return { via: "grok", grokModelId: dest.grokModelId };
  return { via: "api", model: dest.model };
}

export type ImageWriteDest =
  | { split: false }
  | { split: true; via: "grok"; grokModelId: GrokModelId }
  | { split: true; via: "api"; model: string };

export function resolveImageWrite(imageModelId?: string | null): ImageWriteDest {
  if (!imageModelId) return { split: false };
  if (isGrokModelId(imageModelId)) {
    return { split: true, via: "grok", grokModelId: imageModelId as GrokModelId };
  }
  return { split: true, via: "api", model: imageModelId };
}
