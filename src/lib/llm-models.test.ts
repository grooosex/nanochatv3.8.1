import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyLlmPick, catalogFromLinks, chatPickerModels, llmModelKey, llmModelLabel, pruneStarred, resolveLlmSend, snapshotLlmAccount } from "./llm-models.ts";

describe("chatPickerModels", () => {
  it("keeps current even if it left the catalog, and only listed stars", () => {
    assert.deepEqual(
      chatPickerModels(["build-old", "agy-high", "agy-low"], ["agy-high", "agy-low", "agy-mid"], "build-old"),
      ["build-old", "agy-high", "agy-low"],
    );
  });
  it("drops delisted stars once they are not current", () => {
    assert.deepEqual(
      chatPickerModels(["build-old", "agy-high"], ["agy-high", "agy-low"], "agy-high"),
      ["agy-high"],
    );
  });
  it("does not invent stars that were never marked", () => {
    assert.deepEqual(chatPickerModels(["agy-high"], ["agy-high", "agy-low"], "agy-low"), ["agy-low", "agy-high"]);
  });
});

describe("pruneStarred", () => {
  it("keeps a delisted current star until the pick changes", () => {
    assert.deepEqual(pruneStarred(["build-old", "agy-high", "gone"], ["agy-high"], "build-old"), [
      "build-old",
      "agy-high",
    ]);
  });
  it("drops the delisted star after switching away", () => {
    assert.deepEqual(pruneStarred(["build-old", "agy-high"], ["agy-high"], undefined), ["agy-high"]);
  });
});

describe("applyLlmPick", () => {
  const base = {
    llmModels: ["agy-high", "agy-low"],
    llmStarred: ["build-old", "agy-high"],
    llmAccounts: [{ id: "a", name: "号", base: "https://api.example/v1", key: "k", starred: ["build-old"], model: "build-old" }],
    llmBase: "https://api.example/v1",
    llmKey: "k",
  };
  it("clears a delisted star when picking a listed model", () => {
    const next = applyLlmPick(base, "agy-high");
    assert.equal(next.llmModel, "agy-high");
    assert.deepEqual(next.llmStarred, ["agy-high"]);
    assert.deepEqual(next.llmAccounts[0].starred, ["agy-high"]);
    assert.equal(next.llmAccounts[0].model, "agy-high");
  });
  it("keeps the delisted pick if it is chosen again", () => {
    const next = applyLlmPick({ ...base, llmStarred: ["build-old", "agy-high"] }, "build-old");
    assert.deepEqual(next.llmStarred, ["build-old", "agy-high"]);
  });
});

describe("snapshotLlmAccount", () => {
  it("only rewrites the matching key", () => {
    const accounts = [
      { id: "a", name: "一", base: "https://a", key: "1", starred: ["x"], model: "x" },
      { id: "b", name: "二", base: "https://b", key: "2", starred: ["y"], model: "y" },
    ];
    const next = snapshotLlmAccount(accounts, "https://a", "1", ["z"], "z");
    assert.deepEqual(next[0].starred, ["z"]);
    assert.equal(next[1].model, "y");
  });
});

describe("multi llm", () => {
  const a = { id: "a", name: "甲", base: "https://a/v1", key: "ka", starred: ["same"], model: "same" };
  const b = { id: "b", name: "乙", base: "https://b/v1", key: "kb", starred: ["only-b"], model: "only-b" };

  it("keeps each model on its own account", () => {
    const packed = catalogFromLinks([
      { account: a, models: ["same", "only-a"] },
      { account: b, models: ["same", "only-b"] },
    ]);
    assert.equal(packed.llmModels.length, 4);
    assert.ok(packed.llmStarred.includes(llmModelKey("a", "same")));
    assert.ok(packed.llmStarred.includes(llmModelKey("b", "only-b")));
    assert.equal(llmModelLabel(llmModelKey("a", "same"), [a, b], packed.llmModels), "same · 甲");
    assert.equal(llmModelLabel(llmModelKey("a", "only-a"), [a, b], packed.llmModels), "only-a");
    const sent = resolveLlmSend(
      { llmBase: "", llmKey: "", llmAccounts: [a, b], llmModels: packed.llmModels },
      llmModelKey("b", "same"),
    );
    assert.equal(sent.baseUrl, "https://b/v1");
    assert.equal(sent.apiKey, "kb");
    assert.equal(sent.model, "same");
  });

  it("does not write another account's star when picking", () => {
    const key = llmModelKey("b", "only-b");
    const next = applyLlmPick(
      {
        llmModels: [llmModelKey("a", "same"), key],
        llmStarred: [key],
        llmAccounts: [a, b],
        llmBase: "",
        llmKey: "",
      },
      key,
    );
    assert.equal(next.llmAccounts[1].model, "only-b");
    assert.deepEqual(next.llmAccounts[0].starred, ["same"]);
  });
});
