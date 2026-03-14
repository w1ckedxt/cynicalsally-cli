import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const CONFIG_DIR = join(homedir(), ".sally");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface SallyConfig {
  device_id?: string;
  email?: string;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig(): SallyConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: SallyConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

/** Get or create a persistent device ID */
export function getDeviceId(): string {
  const config = readConfig();
  if (config.device_id) return config.device_id;

  const id = randomUUID();
  config.device_id = id;
  writeConfig(config);
  return id;
}

/** Save email after successful login */
export function saveEmail(email: string): void {
  const config = readConfig();
  config.email = email;
  writeConfig(config);
}

/** Get stored email */
export function getEmail(): string | undefined {
  return readConfig().email;
}

/** Clear session (logout) */
export function clearSession(): void {
  const config = readConfig();
  delete config.email;
  writeConfig(config);
}

/** Check if user is logged in */
export function isLoggedIn(): boolean {
  return !!readConfig().email;
}
