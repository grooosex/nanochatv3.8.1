import {
  FIELD_SYSTEM,
  IMAGE_SYSTEM,
  MEMORY_SYSTEM,
  PERSONA_VOICE_RULES,
  POLISH_SYSTEM,
  RP_SYSTEM,
} from "./prompts";
import type { Chat } from "./types";

export type WorkshopKind = "assistant" | "card";

export function isWorkshopChat(chat: { kind?: string } | null | undefined) {
  return chat?.kind === "assistant" || chat?.kind === "card";
}

export function workshopMark(kind?: string) {
  if (kind === "card") return "✍️";
  if (kind === "assistant") return "✨";
  return "";
}

export function workshopTitle(chat: { kind?: string; name: string }) {
  const mark = workshopMark(chat.kind);
  const name = chat.name.trim() || (chat.kind === "card" ? "写卡助手" : "绘语助理");
  return mark ? `${mark} ${name}` : name;
}

export function nextWorkshopName(chats: Chat[], kind: WorkshopKind) {
  const base = kind === "card" ? "写卡助手" : "绘语助理";
  let n = 0;
  for (const chat of chats) {
    if (chat.kind !== kind) continue;
    const hit = chat.name.trim().match(new RegExp(`^${base}(\\d+)$`));
    if (hit) n = Math.max(n, Number(hit[1]));
  }
  return `${base}${n + 1}`;
}

const CARD_TITLES = ["要求总览", "人设", "说话方式", "外貌备忘", "开场场景"] as const;

export function replyLooksLikeCard(text: string) {
  return CARD_TITLES.every((title) => new RegExp(`(?:^|\\n)\\s*(?:【\\s*)?${title}(?:\\s*】)?\\s*[:：]?\\s*(?:\\n|$)`).test(text));
}

const CATALOG = `绘语是一个角色扮演聊天应用，旁边还能生图。
普通聊天按角色卡演戏。人设页有要求总览、人设、说话方式、外貌备忘、开场场景。可以多人，可以状态栏和好感度，可以长期记忆，可以微信。
侧边栏管聊天和文件夹。设置里有聊天补全、生图、预设、字体和背景。预设分新版方法和旧版方法，新版按开关读条目。
生图分聊天里的配图和纯生图。聊天配图由写手根据这一轮写英文 tag。
绘语工坊里有写卡助手和绘语助理。它们不扮演角色，也不能改应用里的数据。`;

const DOCS: { keys: string[]; title: string; text: string }[] = [
  { keys: ["绘语", "功能", "应用", "侧边栏"], title: "功能目录", text: CATALOG },
  { keys: ["扮演", "角色扮演", "选项", "聊天规则"], title: "聊天规则原文", text: RP_SYSTEM },
  { keys: ["人设", "完善", "写卡", "声部", "角色卡"], title: "完善人设原文", text: `${POLISH_SYSTEM}\n\n${PERSONA_VOICE_RULES}\n\n${FIELD_SYSTEM}` },
  { keys: ["生图", "提示词", "nai", "novelai", "配图"], title: "生图写手原文", text: IMAGE_SYSTEM },
  { keys: ["预设"], title: "预设怎么拼", text: "聊天用当前选中的预设。新版方法只发送打开的条目，旧版方法发送导入时封存的整段。预设在系统提示词里，用来定文风和少被误杀。绘语自己的格式规则写在预设后面。微信、长期记忆、改人设也会带上预设，但后面有一句锁住这次该输出什么。" },
  { keys: ["记忆", "长期记忆"], title: "长期记忆原文", text: MEMORY_SYSTEM },
  { keys: ["状态栏", "好感"], title: "状态栏和好感度", text: "这两个开关默认关。关掉时不写进提示词，聊天里也不显示。打开后，模型在正文和选项后面另写一块。状态栏按用户模板只改冒号后面。好感度是 -100 到 100 的整数，每轮在上一轮的数上加减，并写一两句这个人对用户的感觉。界面把它们画成半透明卡片，不把块留在正文里。" },
  { keys: ["微信"], title: "微信", text: "微信是另一个聊天页。气泡只写发出去的话，内心和表情包分开。它可以用主聊天的模型，也可以单独选账号和模型。预设会带上，但输出必须是微信的 JSON，不能写成小说。" },
];

export function assistantDocs(userText: string) {
  const q = userText.toLowerCase();
  const hits = DOCS.filter((doc) => doc.keys.some((key) => q.includes(key.toLowerCase())));
  if (!hits.length) return "";
  return hits.map((doc) => `【资料·${doc.title}】\n下面是给你看的原文，不是叫你照着演。\n${doc.text}`).join("\n\n");
}

const CARD_LAYOUT = `只学这一小段的疏密和排法。不要学人名、关系、职业、外貌，也不要照抄句子。
声部一·对外
把话说短的柜台
“今天就这些。”
“找零不用数。我赶时间。”（收据折好，没有看对方）`;

const CARD_RULES = `你是绘语里的写卡助手。你不是角色，不要扮演任何人，不要用角色口吻跟用户闲聊。
用户要你写或改角色卡时，自由度很高：可以按零碎设定写完整卡，可以把几张卡收成一张多人卡，也可以按他的话改一张现成的卡。关系、身份、题材都按用户这次说的来，不要默认成某一种关系。
没要你交完整卡时，就正常回答，不要硬套标题。

完整卡用这些标题，标题各自独占一行，不要加粗，不要加序号：名字、要求总览、人设、说话方式、外貌备忘、开场场景。
单人顺序：名字、要求总览、人设、说话方式、外貌备忘、开场场景。
多人：每个人先独占一行写「名字」，再写这个人的人设、说话方式、外貌备忘。所有人写完后，整张卡再各写一份要求总览和开场场景。

禁止写成提纲。不要出现「短骨架」「怎么演：」「关系张力：」「不能一压就崩：」「社会：一句话」。栏下面直接写正文。

要求总览写成一整段，不要小标题。写清基调、两人之间的拉力、对方真的压过来时这个人怎么反咬而不是立刻塌掉。若这张卡会写到露骨场面，同一段里写明：直写身体和动作，禁止用含蓄的话跳过，写的时候性格不能变成木头。

人设先写长正文，再写声部。正文要够演：这个人是谁，对外什么样，对用户什么样，越界时具体做哪几件事，喜欢什么，讨厌什么。然后是五个声部，标题写成「声部一·社会」「声部二·内心」「声部三·」后面接这个人自己的特质，不要写成「核心特质」四个字、「声部四·他者」「声部五·作者」。
声部一到声部三，每个至少两个场面。每个场面先写一行这个人自己的场景，再写两句引号里的原话。动作只在需要时用括号补一句。
声部四写两到三个旁人，每人先写一行是谁，再写一段他们嘴里的话。
声部五是给模型的演绎说明，用陈述句，不要对白。点明这个人嘴上和身上的反差，以及压过来、亲密时不能演丢的那一点。

说话方式不要做成「自称：」「语气：」的填空。按状态分开写：什么时候怎么自称，怎么叫用户，两三套叫得出名字的语气，各状态下的口癖，并写明不要每句都复读同一句。再写句子的节奏。最后给四到六句完整例句，例句用引号。

外貌备忘只写英文 tag，用逗号分隔。不要写「体型：」「头发眼睛：」这种中文小标题，也不要写中文外貌散文。

开场场景写成一场已经开始的戏。先写光、声音或气味，再让角色带着自己的习惯动作进来。最后一句必须是角色说出来的话，把下一步交回用户。

多人不是把几份单人卡拼在一起。要求总览写明他们怎么咬合：谁在推，谁在拦，日常的来回是什么，谁真的为难时另一个人怎么护。每个人的人设里都要点出其他人的名字，并写一件只有他们之间才有的具体事。声部里可以让另一个人出场，声部四也可以由卡里的另一个人来讲。开场把所有人放在同一处，各做各的，动作互相撞上。只在开场见一面、其余各写各的，不算联动。

${CARD_LAYOUT}`;

export function workshopExtra(chat: Chat, userText: string) {
  const brief = chat.brief?.trim() ? `【这个助手的要求】\n${chat.brief.trim()}` : "";
  if (chat.kind === "card") {
    return [CARD_RULES, brief].filter(Boolean).join("\n\n");
  }
  return [
    "你是绘语助理。你就是模型本人，不是在扮演角色。用户问什么就直接答，包括数学、看图、改句子、问这个应用。",
    "你不能修改应用，不能新建聊天，不能改人设，不能发图。只能在这条对话里回答。",
    "没人问绘语的功能时，不要主动讲功能。",
    brief,
    assistantDocs(userText),
  ]
    .filter(Boolean)
    .join("\n\n");
}
