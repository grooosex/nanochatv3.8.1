const STATUS_LINE = /^\s*状态栏\s*[:：]\s*$/;
const LOVE_LINE = /^\s*(?:💞|❤️|❤)?\s*好感度\s*[:：]/;

function isLove(line: string) {
  return LOVE_LINE.test(line);
}

function isQuote(line: string) {
  return /^\s*💬/.test(line) || /「[^」]*」/.test(line);
}

export function readAffinity(text: string): number | null {
  const m = text.match(/(?:💞|❤️|❤)?\s*好感度\s*[:：]\s*(-?\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.max(-100, Math.min(100, Math.round(n)));
}

export type StatusLine = { title: string; value: string };
export type AffinityBits = { value: number; delta: number; stage: string; quote: string };
export type SceneCard = { name: string; lines: StatusLine[]; affinity: AffinityBits | null };

function splitField(line: string): StatusLine | null {
  const i = line.search(/[:：]/);
  if (i < 0) return null;
  const title = line.slice(0, i).trim();
  if (!title || isLove(line) || isQuote(line)) return null;
  return { title, value: line.slice(i + 1).trim() };
}

function bareName(line: string): string | null {
  const t = line.trim();
  if (!t || STATUS_LINE.test(t) || isLove(t) || isQuote(t) || splitField(t)) return null;
  const person = t.match(/^👤\s*(.+)$/);
  if (person) return person[1].replace(/[:：].*$/, "").trim();
  if (t.length > 24 || /[。！？]/.test(t)) return null;
  return t;
}

function parseInner(inner: string): { delta: number; stage: string } {
  const m = inner.match(/(-?\d+)\s*(?:Ⅰ|,|，)\s*(.*)$/);
  if (!m) return { delta: 0, stage: inner.trim() };
  return { delta: Number(m[1]) || 0, stage: m[2].trim() };
}

export function parseAffinity(text: string): AffinityBits | null {
  const lines = text.split("\n");
  const love = lines.find(isLove);
  if (!love) return null;
  const value = readAffinity(love);
  if (value == null) return null;
  const bracket = love.match(/[\[［]([^\]］]+)[\]］]/) ?? love.match(/[（(]([^）)]+)[）)]/);
  const inner = parseInner(bracket?.[1] ?? "");
  const joined = lines.join("\n");
  const quoted = joined.match(/「([^」]*)」/);
  let quote = quoted ? quoted[1].trim() : "";
  if (!quote) {
    const after = love.split(/➕|＋|——/).slice(1).join("").trim();
    quote = after.replace(/^「|」$/g, "").trim();
  }
  return { value, delta: inner.delta, stage: inner.stage, quote };
}

export function formatDelta(delta: number) {
  if (delta > 0) return `📈+${delta}`;
  if (delta < 0) return `📉${delta}`;
  return "0";
}

export function formatAffinity(a: AffinityBits) {
  return `💞好感度:${a.value}[${formatDelta(a.delta)}Ⅰ${a.stage}]\n「${a.quote}」`;
}

function blockToCard(raw: string, fallback: string): SceneCard {
  const lines = raw.split("\n");
  let name = "";
  const fields: StatusLine[] = [];
  const love: string[] = [];
  let seenField = false;
  for (const line of lines) {
    if (!line.trim() || STATUS_LINE.test(line)) continue;
    if (isLove(line) || isQuote(line)) {
      love.push(line);
      continue;
    }
    if (!seenField) {
      const bare = bareName(line);
      if (bare) {
        if (!name) name = bare;
        continue;
      }
    }
    const field = splitField(line);
    if (!field) continue;
    if (/^👤/.test(field.title)) {
      if (!name) name = field.title.replace(/^👤\s*/, "").trim() || field.value;
      continue;
    }
    seenField = true;
    fields.push(field);
  }
  return { name: name || fallback, lines: fields, affinity: parseAffinity(love.join("\n")) };
}

function cardsFromStatus(raw: string, fallback: string): SceneCard[] {
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let seenField = false;
  let seenLove = false;
  let started = false;
  const titles = new Set<string>();
  const flush = () => {
    if (chunk.some((line) => line.trim())) chunks.push(chunk);
    chunk = [];
    seenField = false;
    seenLove = false;
    started = false;
    titles.clear();
  };
  for (const line of raw.split("\n")) {
    if (!line.trim() || STATUS_LINE.test(line)) continue;
    const love = isLove(line);
    const field = splitField(line);
    const bare = !love && !field ? bareName(line) : null;
    const repeat = Boolean(field && titles.has(field.title));
    const another = started && ((Boolean(bare) && (seenField || seenLove)) || (love && seenLove) || repeat);
    if (another) flush();
    chunk.push(line);
    started = true;
    if (love) seenLove = true;
    if (field && !/^👤/.test(field.title)) {
      seenField = true;
      titles.add(field.title);
    }
  }
  flush();
  return chunks.map((lines, i) => blockToCard(lines.join("\n"), i === 0 ? fallback : ""));
}

/** Pull status blocks and affinity lines out of a reply. Stored text is unchanged. */
export function readScene(text: string, fallbackName = ""): { body: string; cards: SceneCard[] } {
  const lines = text.split("\n");
  const body: string[] = [];
  const cards: SceneCard[] = [];
  let status: string[] | null = null;
  const flush = () => {
    if (!status) return;
    const raw = status.join("\n").trim();
    status = null;
    if (!raw) return;
    cards.push(...cardsFromStatus(raw, fallbackName));
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (STATUS_LINE.test(line)) {
      flush();
      status = [line];
      continue;
    }
    if (status) {
      status.push(line);
      continue;
    }
    if (isLove(line)) {
      const buf = [line];
      while (i + 1 < lines.length && lines[i + 1].trim() && !STATUS_LINE.test(lines[i + 1]) && !isLove(lines[i + 1])) {
        i += 1;
        buf.push(lines[i]);
      }
      const card = blockToCard(buf.join("\n"), fallbackName);
      if (card.affinity || card.lines.length) cards.push(card);
      continue;
    }
    body.push(line);
  }
  flush();
  return { body: body.join("\n").replace(/\n{3,}/g, "\n\n").trim(), cards };
}

export function presentScene(
  text: string,
  opts: { status: boolean; affection: boolean },
  fallbackName = "",
): { body: string; cards: SceneCard[] } {
  const scene = readScene(text, fallbackName);
  if (!opts.status && !opts.affection) return { body: scene.body, cards: [] };
  const cards = scene.cards
    .map((c) => ({
      ...c,
      lines: opts.status ? c.lines : [],
      affinity: opts.affection ? c.affinity : null,
    }))
    .filter((c) => c.lines.length > 0 || c.affinity);
  return { body: scene.body, cards };
}

export function writeScene(body: string, cards: SceneCard[], nameLine = false): string {
  const tail = cards
    .map((card) => {
      const love = card.affinity ? formatAffinity(card.affinity) : "";
      if (!card.lines.length) return love;
      const head = ["状态栏:"];
      if (nameLine && card.name) head.push(card.name);
      if (love) head.push(love);
      for (const line of card.lines) head.push(`${line.title}:${line.value}`);
      return head.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
  return [body.trim(), tail].filter(Boolean).join("\n\n");
}

export function affinityUpdates(text: string): { name: string; value: number }[] {
  return readScene(text).cards.flatMap((c) => (c.affinity ? [{ name: c.name, value: c.affinity.value }] : []));
}
