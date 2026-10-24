import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { readProject } from "./record";
import { markLabel, present } from "./view";

const fixtures = join(import.meta.dir, "../fixtures");

describe("present", () => {
  test("names the six stage states and the next action", () => {
    expect(markLabel(" ", "EXECUTE")).toBe("Not started");
    expect(markLabel(" ", "SKIP")).toBe("Planned skip");
    expect(markLabel("-", "EXECUTE")).toBe("In progress");
    expect(markLabel("?", "EXECUTE")).toBe("Waiting for approval");
    expect(markLabel("R", "EXECUTE")).toBe("Revising");
    expect(markLabel("x", "EXECUTE")).toBe("Done");
    expect(markLabel("S", "EXECUTE")).toBe("Skipped");

    const blank = readProject(join(fixtures, "blank-answer"));
    const view = present(blank, null);
    expect(view.headline).toBe("blank");
    expect(view.nextLabel).toBe("Answer Q2");
    expect(view.draftLabel).toBe("Answer Q2");
    expect(view.openFile).toContain("notes.md");
    expect(view.summary.map((row) => row.label)).toEqual(["Space", "Phase", "Current stage", "Next stage", "Status"]);

    const idle = present(readProject(join(fixtures, "idle")), null);
    expect(idle.nextLabel).toBe("Nothing is waiting");
    expect(idle.draftLabel).toBeNull();
    expect(idle.openFile).toBeNull();

    const choose = present(readProject(join(fixtures, "several-intents")), "notes.md");
    expect(choose.headline).toBe("Which piece of work should Navigator open?");
    expect(choose.choices.map((choice) => choice.label)).toEqual(["one", "two"]);
    expect(choose.openFile).toBeNull();
    expect(present(null, null).headline).toBe("Open a project folder.");
    expect(present({ kind: "missing-record" }, null).headline).toBe("This folder has no AI-DLC record.");
  });
});
