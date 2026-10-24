import { describe, expect, test } from "bun:test";
import { resolveWorkflowCommand, type CommandProbe } from "./resolve-command";
import { commandMessage } from "./view";

function probe(partial: Partial<CommandProbe> & Pick<CommandProbe, "platform" | "exists">): CommandProbe {
  return {
    env: {},
    home: partial.platform === "win32" ? "C:\\Users\\a" : "/home/a",
    ...partial,
  };
}

describe("resolveWorkflowCommand", () => {
  test("uses a command on PATH", () => {
    const resolved = resolveWorkflowCommand(probe({
      platform: "linux",
      env: { PATH: "/usr/bin:/opt/bin" },
      exists: (path) => path === "/opt/bin/aidlc",
    }));
    expect(resolved.path).toBe("/opt/bin/aidlc");
  });

  test("uses the Windows install path when PATH has no command", () => {
    const fallback = "C:\\Users\\a\\AppData\\Local\\aidlc\\bin\\aidlc.cmd";
    const resolved = resolveWorkflowCommand(probe({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local", Path: "" },
      exists: (path) => path === fallback,
    }));
    expect(resolved.path).toBe(fallback);
  });

  test("uses the Unix install path when PATH has no command", () => {
    const fallback = "/home/a/.local/bin/aidlc";
    const resolved = resolveWorkflowCommand(probe({
      platform: "darwin",
      home: "/home/a",
      exists: (path) => path === fallback,
    }));
    expect(resolved.path).toBe(fallback);
  });

  test("reports a missing command, including an override that is not there", () => {
    const onPath = "/opt/bin/aidlc";
    const missing = probe({
      platform: "linux",
      env: { PATH: "/opt/bin" },
      exists: (path) => path === onPath,
    });
    expect(resolveWorkflowCommand(missing, "/missing/tool").path).toBeNull();
    expect(resolveWorkflowCommand({ ...missing, exists: () => false }).path).toBeNull();
    expect(resolveWorkflowCommand(missing, "/custom/tool").path).toBeNull();
    expect(resolveWorkflowCommand({
      ...missing,
      exists: (path) => path === onPath || path === "/custom/tool",
    }, "/custom/tool").path).toBe("/custom/tool");
  });

  test("describes a found path, a missing lookup, and a rejected override", () => {
    expect(commandMessage("", "/opt/bin/aidlc")).toBe("/opt/bin/aidlc");
    expect(commandMessage("", null)).toBe("No workflow command was found.");
    expect(commandMessage("/missing/tool", null)).toBe("That command path is not available.");
  });
});
