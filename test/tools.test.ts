import test from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import clickupExtension from "../index.ts";

type AnyTool = ToolDefinition<any, any, any>;

function tools(): Record<string, AnyTool> {
  const registered: Record<string, AnyTool> = {};
  clickupExtension({ registerTool: (tool: AnyTool) => { registered[tool.name] = tool; } } as unknown as ExtensionAPI);
  return registered;
}

test("declares sequential execution so concurrent confirmations cannot race the dialog", async () => {
  // clickup_api opens a blocking ctx.ui.confirm() dialog for every DELETE and file upload.
  // Pi's agent loop runs same-turn tool calls in parallel unless a tool declares
  // executionMode "sequential" - without that flag, two concurrent mutating/upload calls
  // in one turn could race the same TUI dialog and stall with no visible prompt, exactly
  // as observed and fixed in the sibling pi-teamwork extension. Guard the declaration
  // directly, since a full replay of Pi's parallel scheduler is out of scope here.
  assert.equal(tools().clickup_api.executionMode, "sequential");
});
