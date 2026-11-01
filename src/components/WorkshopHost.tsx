import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { emptyCharacter } from "@/lib/constants";
import { parseRoleText } from "@/lib/role-text";
import { nextWorkshopName } from "@/lib/workshop";
import { useApp } from "@/lib/store";
import type { CharacterCard } from "@/lib/types";
import { uid } from "@/lib/utils";
import { CustomAvatar } from "./RoleEditor";
import { FieldLabel, TextArea, TextInput } from "./ui-kit";

export function WorkshopHost() {
  return (
    <>
      <NameDialog />
      <EditDialog />
      <AvatarDialog />
      <SaveCardDialog />
    </>
  );
}

function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[70] flex justify-center px-4 py-8">
      <div className="absolute inset-0 bg-overlay/40" onClick={onClose} />
      <div className="relative z-10 flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-bg shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 px-5 pb-3 pt-5">
          <h2 className="text-[20px] font-semibold">{title}</h2>
          <button type="button" className="ml-auto" onClick={onClose} aria-label="关闭">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 scroll-hide">{children}</div>
        {footer && <div className="shrink-0 space-y-2 px-5 pb-5">{footer}</div>}
      </div>
    </div>
  );
}

function NameDialog() {
  const kind = useApp((s) => s.ui.workshopName);
  const chats = useApp((s) => s.chats);
  const [val, setVal] = useState("");
  useEffect(() => setVal(""), [kind]);
  if (!kind) return null;
  const title = kind === "card" ? "请输入写卡助手名" : "请输入绘语助理名";
  const close = () => useApp.getState().setUI({ workshopName: null });
  const make = (name: string) => {
    useApp.getState().createWorkshop(kind, name);
    close();
  };
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-overlay p-6">
      <div className="w-full max-w-sm rounded-[24px] bg-bg p-5">
        <div className="mb-3 flex items-center">
          <div className="text-[16px] font-semibold">{title}</div>
          <button type="button" className="ml-auto" onClick={close} aria-label="关闭">
            <X className="size-5" />
          </button>
        </div>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="h-12 w-full rounded-full border border-line bg-card px-4"
        />
        <div className="mt-4 flex gap-3">
          <button className="flex-1 py-3 text-muted" onClick={() => make(nextWorkshopName(chats, kind))}>
            跳过
          </button>
          <button
            className="flex-1 rounded-full bg-primary py-3 text-on-primary"
            onClick={() => make(val.trim() || nextWorkshopName(chats, kind))}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDialog() {
  const id = useApp((s) => s.ui.workshopEditId);
  const chat = useApp((s) => s.chats.find((c) => c.id === id));
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  useEffect(() => {
    if (!chat) return;
    setName(chat.name);
    setBrief(chat.brief || "");
  }, [id]);
  if (!id || !chat) return null;
  const close = () => useApp.getState().setUI({ workshopEditId: null });
  return (
    <Sheet
      title="修改设定"
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="h-12 w-full rounded-full bg-primary text-[15px] font-medium text-on-primary"
            onClick={() => {
              const next = name.trim() || chat.name;
              useApp.getState().patchChat(chat.id, {
                name: next,
                brief,
                characters: chat.characters.map((c, i) => (i === 0 ? { ...c, name: next } : c)),
              });
              useApp.getState().toast("已保存");
              close();
            }}
          >
            确认保存
          </button>
          <button type="button" className="h-10 w-full text-[14px] text-muted" onClick={close}>
            取消
          </button>
        </>
      }
    >
      <FieldLabel>名称</FieldLabel>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4">
        <FieldLabel>要求</FieldLabel>
        <TextArea className="min-h-[160px]" value={brief} onChange={(e) => setBrief(e.target.value)} />
      </div>
    </Sheet>
  );
}

function AvatarDialog() {
  const open = useApp((s) => s.ui.workshopAvatars);
  const card = useApp((s) => s.settings.workshopCardAvatar);
  const assist = useApp((s) => s.settings.workshopAssistAvatar);
  if (!open) return null;
  const close = () => useApp.getState().setUI({ workshopAvatars: false });
  const set = (key: "workshopCardAvatar" | "workshopAssistAvatar", id: string) => {
    useApp.getState().setSettings({ [key]: id || undefined });
  };
  return (
    <Sheet title="设置头像" onClose={close}>
      <p className="mb-3 text-[12px] text-muted">只作用于以后新建的。已经建好的不改。</p>
      <CustomAvatar blobId={card} label="写卡助手" onId={(id) => set("workshopCardAvatar", id)} onClear={() => set("workshopCardAvatar", "")} />
      <div className="mt-4">
        <CustomAvatar blobId={assist} label="绘语助理" onId={(id) => set("workshopAssistAvatar", id)} onClear={() => set("workshopAssistAvatar", "")} />
      </div>
    </Sheet>
  );
}

function SaveCardDialog() {
  const text = useApp((s) => s.ui.workshopCardText);
  const [draft, setDraft] = useState<CharacterCard | null>(null);
  useEffect(() => {
    if (!text) {
      setDraft(null);
      return;
    }
    const parsed = parseRoleText(text);
    const people = parsed.people.length ? parsed.people : [{}];
    const characters = people.map((p, i) => ({
      ...emptyCharacter(i + 1),
      id: uid("c_"),
      name: p.name || "",
      persona: p.persona || "",
      speech: p.speech || "",
      appearance: p.appearance || "",
    }));
    setDraft({
      id: uid("card_"),
      name: characters.map((c) => c.name).filter(Boolean).join("、") || "未命名",
      isMulti: characters.length > 1,
      overview: parsed.overview || "",
      opening: parsed.opening || "",
      extras: [],
      statusBarOn: false,
      statusBar: "",
      characters,
      grokModelId: useApp.getState().settings.grokModelId,
      createdAt: Date.now(),
      order: Date.now(),
    });
  }, [text]);
  if (!text || !draft) return null;
  const close = () => useApp.getState().setUI({ workshopCardText: null });
  const patchChar = (id: string, p: Partial<(typeof draft.characters)[number]>) => {
    setDraft((d) => (d ? { ...d, characters: d.characters.map((c) => (c.id === id ? { ...c, ...p } : c)) } : d));
  };
  return (
    <Sheet
      title="保存为角色卡"
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="h-12 w-full rounded-full bg-primary text-[15px] font-medium text-on-primary"
            onClick={() => useApp.getState().addCard({ ...draft, name: draft.name.trim() || "未命名", isMulti: draft.characters.length > 1 })}
          >
            保存
          </button>
          <button type="button" className="h-10 w-full text-[14px] text-muted" onClick={close}>
            取消
          </button>
        </>
      }
    >
      <FieldLabel hint="列表里显示的名字。">卡名</FieldLabel>
      <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <div className="mt-4">
        <FieldLabel>要求总览</FieldLabel>
        <TextArea className="min-h-[96px]" value={draft.overview} onChange={(e) => setDraft({ ...draft, overview: e.target.value })} />
      </div>
      {draft.characters.map((c, i) => (
        <div key={c.id} className="mt-4 rounded-[18px] border border-line p-3">
          <div className="mb-2 text-[13px] font-medium">{draft.characters.length > 1 ? `角色${i + 1}` : "角色"}</div>
          <FieldLabel>名字</FieldLabel>
          <TextInput value={c.name} onChange={(e) => patchChar(c.id, { name: e.target.value })} />
          <div className="mt-3">
            <FieldLabel>人设</FieldLabel>
            <TextArea className="min-h-[96px]" value={c.persona} onChange={(e) => patchChar(c.id, { persona: e.target.value })} />
          </div>
          <div className="mt-3">
            <FieldLabel>说话方式</FieldLabel>
            <TextArea className="min-h-[80px]" value={c.speech} onChange={(e) => patchChar(c.id, { speech: e.target.value })} />
          </div>
          <div className="mt-3">
            <FieldLabel>外貌备忘</FieldLabel>
            <TextArea className="min-h-[72px]" value={c.appearance} onChange={(e) => patchChar(c.id, { appearance: e.target.value })} />
          </div>
        </div>
      ))}
      <div className="mt-4">
        <FieldLabel>开场场景</FieldLabel>
        <TextArea className="min-h-[96px]" value={draft.opening} onChange={(e) => setDraft({ ...draft, opening: e.target.value })} />
      </div>
    </Sheet>
  );
}
