import { describe, expect, test } from "bun:test";
import { liveRecents, parsePreferences, rememberProject } from "./preferences";

describe("preferences", () => {
  test("keeps the eight most recent folders, newest first", () => {
    let list = rememberProject([], "/one", "t1");
    list = rememberProject(list, "/two", "t2");
    for (let index = 3; index <= 10; index++) list = rememberProject(list, `/p${index}`, `t${index}`);
    expect(list).toHaveLength(8);
    expect(list[0]).toEqual({ path: "/p10", openedAt: "t10" });
    expect(list.some((item) => item.path === "/one")).toBe(false);
    list = rememberProject(list, "/two", "again");
    expect(list[0]).toEqual({ path: "/two", openedAt: "again" });
    expect(list.filter((item) => item.path === "/two")).toHaveLength(1);
  });

  test("drops folders that are gone and ignores stored file contents", () => {
    const parsed = parsePreferences(JSON.stringify({
      recentProjects: [
        { path: "/keep", openedAt: "t" },
        { path: "/gone", openedAt: "t" },
        { path: "" },
      ],
      chosenIntent: { "/keep": { space: "default", dirName: "261024-one" } },
      files: "secret source",
    }));
    expect(parsed.chosenIntent["/keep"]).toEqual({ space: "default", dirName: "261024-one" });
    expect("files" in parsed).toBe(false);
    expect(liveRecents(parsed.recentProjects, (path) => path === "/keep")).toEqual([
      { path: "/keep", openedAt: "t" },
    ]);
    expect(parsePreferences("{")).toEqual({ recentProjects: [], chosenIntent: {} });
  });
});
