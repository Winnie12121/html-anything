import path from "node:path";
import { ensureDir, pathExists, readJsonFile, writeJsonFile } from "./fs";
import { WORKSPACE_SCHEMA_VERSION, type AppWorkspaceConfig } from "./schema";

export const DEFAULT_WORKSPACE_DIR_NAME = "Industry_Insight_Studio_Demo";
export const WORKSPACE_ROOT_ENV = "INDUSTRY_INSIGHT_WORKSPACE_ROOT";
export const APP_CONFIG_DIR_NAME = ".industry-insight";
export const APP_CONFIG_FILE_NAME = "workspace-config.json";

type ConfigOptions = {
  cwd?: string;
  env?: Partial<NodeJS.ProcessEnv>;
  appConfigDir?: string;
};

export function defaultWorkspaceRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, "workspaces", DEFAULT_WORKSPACE_DIR_NAME);
}

export function appConfigDir(cwd = process.cwd()): string {
  return path.resolve(cwd, APP_CONFIG_DIR_NAME);
}

function configRoot(options: ConfigOptions = {}): string {
  return options.appConfigDir ?? appConfigDir(options.cwd);
}

export function appConfigRelativePath(): string {
  return APP_CONFIG_FILE_NAME;
}

export async function readAppWorkspaceConfig(
  options: ConfigOptions = {},
): Promise<AppWorkspaceConfig> {
  const envRoot = options.env?.[WORKSPACE_ROOT_ENV] ?? process.env[WORKSPACE_ROOT_ENV];
  if (envRoot) {
    return {
      version: WORKSPACE_SCHEMA_VERSION,
      workspaceRoot: path.resolve(options.cwd ?? process.cwd(), envRoot),
      updatedAt: new Date(0).toISOString(),
    };
  }

  const root = configRoot(options);
  const configPath = path.join(root, appConfigRelativePath());
  if (await pathExists(configPath)) {
    return readJsonFile<AppWorkspaceConfig>(root, appConfigRelativePath());
  }

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    workspaceRoot: defaultWorkspaceRoot(options.cwd),
    updatedAt: new Date(0).toISOString(),
  };
}

export async function writeAppWorkspaceConfig(
  workspaceRoot: string,
  options: ConfigOptions = {},
): Promise<AppWorkspaceConfig> {
  const root = configRoot(options);
  await ensureDir(root);

  const config: AppWorkspaceConfig = {
    version: WORKSPACE_SCHEMA_VERSION,
    workspaceRoot: path.resolve(options.cwd ?? process.cwd(), workspaceRoot),
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(root, appConfigRelativePath(), config);
  return config;
}
