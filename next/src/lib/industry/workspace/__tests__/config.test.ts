import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_ROOT_ENV,
  defaultWorkspaceRoot,
  readAppWorkspaceConfig,
  writeAppWorkspaceConfig,
} from "../config";

describe("workspace config", () => {
  let root: string;
  let appConfigDir: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-config-"));
    appConfigDir = path.join(root, ".config");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("defaults to the demo workspace under the app cwd", async () => {
    const config = await readAppWorkspaceConfig({
      cwd: root,
      appConfigDir,
      env: {},
    });
    expect(config.workspaceRoot).toBe(defaultWorkspaceRoot(root));
  });

  it("persists a configured workspace root", async () => {
    const workspaceRoot = path.join(root, "Shared Drive", "Industry Demo");
    await writeAppWorkspaceConfig(workspaceRoot, { cwd: root, appConfigDir });

    const config = await readAppWorkspaceConfig({
      cwd: root,
      appConfigDir,
      env: {},
    });
    expect(config.workspaceRoot).toBe(workspaceRoot);
  });

  it("lets the environment override local config", async () => {
    const config = await readAppWorkspaceConfig({
      cwd: root,
      appConfigDir,
      env: { [WORKSPACE_ROOT_ENV]: "./env-workspace" },
    });
    expect(config.workspaceRoot).toBe(path.resolve(root, "env-workspace"));
  });
});
