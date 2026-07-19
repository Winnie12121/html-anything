import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "./paths";

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function ensureDir(absolutePath: string): Promise<void> {
  await mkdir(absolutePath, { recursive: true });
}

export async function readJsonFile<T>(
  root: string,
  relativePath: string,
): Promise<T> {
  const filePath = safeJoin(root, relativePath);
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJsonFile(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  const filePath = safeJoin(root, relativePath);
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readTextFile(
  root: string,
  relativePath: string,
): Promise<string> {
  return readFile(safeJoin(root, relativePath), "utf8");
}

export async function writeTextFile(
  root: string,
  relativePath: string,
  value: string,
): Promise<void> {
  const filePath = safeJoin(root, relativePath);
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function removeWorkspacePath(
  root: string,
  relativePath: string,
): Promise<void> {
  await rm(safeJoin(root, relativePath), { recursive: true, force: true });
}

export async function readJsonlFile<T>(
  root: string,
  relativePath: string,
): Promise<T[]> {
  const text = await readTextFile(root, relativePath);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function appendJsonl(
  root: string,
  relativePath: string,
  values: unknown[],
): Promise<void> {
  if (values.length === 0) return;

  const filePath = safeJoin(root, relativePath);
  await ensureDir(path.dirname(filePath));
  const payload = `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
  await writeFile(filePath, payload, { encoding: "utf8", flag: "a" });
}

export async function listDirectories(
  root: string,
  relativePath: string,
): Promise<string[]> {
  const dirPath = safeJoin(root, relativePath);
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
