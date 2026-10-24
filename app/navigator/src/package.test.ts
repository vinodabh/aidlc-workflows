import { describe, expect, test } from "bun:test";
import packageJson from "../package.json";

describe("navigator package", () => {
  test("is a private package whose tests run under bun", () => {
    expect(packageJson.private).toBe(true);
    expect(packageJson.name).toBe("navigator");
    expect(packageJson.scripts.test).toBe("bun test");
  });
});
