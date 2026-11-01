import { GROK_MODELS, shortModelLabel } from "@/lib/constants";
import { applyLlmPick, chatPickerModels, llmModelLabel, llmModelName } from "@/lib/llm-models";
import { useApp } from "@/lib/store";
import type { GrokModelId } from "@/lib/types";
import { ExpandSelect } from "./ui-kit";

export function ChatModelSelect({
  align = "center",
  className,
}: {
  align?: "center" | "left";
  className?: string;
}) {
  const source = useApp((s) => s.settings.chatSource);
  const grok = useApp((s) => s.settings.grokModelId);
  const llmModel = useApp((s) => s.settings.llmModel);
  const starred = useApp((s) => s.settings.llmStarred);
  const available = useApp((s) => s.settings.llmModels);
  const accounts = useApp((s) => s.settings.llmAccounts);
  const connected = useApp((s) => s.settings.llmConnected);

  if (source === "api") {
    const ids = chatPickerModels(starred, available, llmModel);
    if (!connected || ids.length === 0) {
      return (
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-full px-3 text-[14px] font-medium text-muted"
          onClick={() => useApp.getState().setUI({ connection: true, llmSettings: true })}
        >
          {connected ? "去标星模型" : "先连接 API"}
        </button>
      );
    }
    return (
      <ExpandSelect
        value={llmModel || ids[0]}
        options={ids.map((id) => {
          const full = llmModelLabel(id, accounts ?? [], available);
          const name = llmModelName(id);
          const short = full === name ? shortModelLabel(name) : `${shortModelLabel(name)}${full.slice(name.length)}`;
          return { id, label: full, short };
        })}
        onChange={(id) => useApp.getState().setSettings(applyLlmPick(useApp.getState().settings, id))}
        align={align}
        className={className}
      />
    );
  }

  return (
    <ExpandSelect<GrokModelId>
      value={grok}
      options={GROK_MODELS.map((m) => ({ id: m.id, label: m.label, short: m.short }))}
      onChange={(id) => useApp.getState().setGrok(id)}
      align={align}
      className={className}
    />
  );
}
