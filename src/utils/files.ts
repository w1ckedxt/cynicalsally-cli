import { readFileSync, statSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, relative, extname, resolve } from "node:path";

export interface ReviewFile {
  path: string;
  content: string;
}

/** Why a file was held back and never sent to the backend. */
export type SkipReason =
  | "secret"
  | "binary"
  | "too-large"
  | "non-reviewable"
  | "gitignored"
  | "skip-file"
  | "skipped-dir"
  | "unreadable";

export interface SkippedFile {
  path: string;
  reason: SkipReason;
  /** Optional human-readable extra (e.g. "142 KB", "null bytes"). */
  detail?: string;
}

/** Result of a directory scan: what would be sent, what was held back. */
export interface CollectResult {
  files: ReviewFile[];
  skipped: SkippedFile[];
  /** True if the scan stopped at MAX_FILES and didn't see everything. */
  truncated: boolean;
}

/** Discriminated result of scanning a single file. */
export type FileScan =
  | { ok: true; file: ReviewFile }
  | { ok: false; skip: SkippedFile };

const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  secret: "looks like a secret — never leaves your machine",
  binary: "binary or non-text",
  "too-large": "over the 100 KB per-file limit",
  "non-reviewable": "not a reviewable code/text file",
  gitignored: "matched a .gitignore rule",
  "skip-file": "lockfile or system file",
  "skipped-dir": "build/dependency/sensitive directory",
  unreadable: "couldn't be read",
};

/** Human-readable reason for a skip, for dry-run reporting. */
export function describeSkipReason(reason: SkipReason): string {
  return SKIP_REASON_LABELS[reason];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Extensions we skip (binaries, images, media, lockfiles)
const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".avif",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".gz", ".tar", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".lock", ".lockb",
  ".map",
]);

// Directories we always skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".vercel", ".turbo",
  "dist", "build", "out", ".output",
  "__pycache__", ".pytest_cache", ".mypy_cache",
  "vendor", "Pods", ".gradle",
  "coverage", ".nyc_output",
]);

// Files we always skip
const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  ".DS_Store", "Thumbs.db",
]);

const SENSITIVE_NAMES = new Set([
  ".env",
  ".envrc",
  ".npmrc",
  ".pypirc",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials",
  "credentials.json",
  "secrets",
  "secrets.json",
  ".netrc",
]);

const SENSITIVE_DIRS = new Set([
  ".aws",
  ".ssh",
  ".gnupg",
  ".sally",
]);

const SENSITIVE_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".crt",
  ".cer",
  ".csr",
  ".der",
  ".kdbx",
  ".ovpn",
  ".asc",
]);

const REVIEWABLE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".php", ".java", ".kt", ".kts", ".scala",
  ".go", ".rs", ".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hh",
  ".cs", ".swift", ".m", ".mm",
  ".sh", ".bash", ".zsh", ".fish", ".ps1",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".vue", ".svelte",
  ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".conf", ".properties",
  ".md", ".mdx", ".txt",
  ".sql", ".graphql", ".gql",
]);

const REVIEWABLE_BASENAMES = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  "Gemfile",
  "Rakefile",
  "CMakeLists.txt",
  ".gitignore",
]);

const MAX_FILES = 50;
const MAX_FILE_SIZE = 100_000; // 100 KB

function getBasename(filePath: string): string {
  return filePath.split("/").pop() || "";
}

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const basename = segments[segments.length - 1] || "";
  const lowerBase = basename.toLowerCase();

  if (SENSITIVE_NAMES.has(basename) || SENSITIVE_NAMES.has(lowerBase)) return true;
  if (lowerBase === ".env" || lowerBase.startsWith(".env.")) return true;
  if (SENSITIVE_EXTENSIONS.has(extname(lowerBase))) return true;

  return segments.some((segment) => {
    const lower = segment.toLowerCase();
    return SENSITIVE_DIRS.has(segment) ||
      SENSITIVE_DIRS.has(lower) ||
      lower === "secrets" ||
      lower === "credentials";
  });
}

function isReviewablePath(filePath: string): boolean {
  const basename = getBasename(filePath);
  if (REVIEWABLE_BASENAMES.has(basename)) return true;
  return REVIEWABLE_EXTENSIONS.has(extname(basename).toLowerCase());
}

/**
 * Scan a single file, returning either the readable file or the reason it was
 * held back. This is the single source of truth for the per-file secret/binary/
 * size rules — `readFileForReview` and the directory walk both build on it, and
 * the dry-run report surfaces the skip reasons to the user.
 *
 * @param displayPath Optional path to report (e.g. relative) instead of filePath.
 */
export function scanFileForReview(filePath: string, displayPath?: string): FileScan {
  const path = displayPath ?? filePath;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return { ok: false, skip: { path, reason: "non-reviewable", detail: "not a file" } };
    // Secrets first: a secret should be reported as a secret even if it's also huge.
    if (isSensitivePath(filePath)) return { ok: false, skip: { path, reason: "secret" } };
    if (SKIP_FILES.has(getBasename(filePath))) return { ok: false, skip: { path, reason: "skip-file" } };
    if (SKIP_EXTENSIONS.has(extname(filePath).toLowerCase())) return { ok: false, skip: { path, reason: "binary" } };
    if (stat.size > MAX_FILE_SIZE) return { ok: false, skip: { path, reason: "too-large", detail: formatBytes(stat.size) } };

    const content = readFileSync(filePath, "utf-8");

    // Skip likely binary files (null bytes in first 512 chars)
    if (content.slice(0, 512).includes("\0")) return { ok: false, skip: { path, reason: "binary", detail: "null bytes" } };

    return { ok: true, file: { path, content } };
  } catch {
    return { ok: false, skip: { path, reason: "unreadable" } };
  }
}

/**
 * Read a single file for review. Returns null if the file is skipped for any
 * reason (binary, secret, too large, unreadable).
 */
export function readFileForReview(filePath: string): ReviewFile | null {
  const result = scanFileForReview(filePath);
  return result.ok ? result.file : null;
}

/**
 * Load .gitignore patterns from a directory.
 * Returns a simple matcher function.
 */
function loadGitignore(dir: string): (path: string) => boolean {
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) return () => false;

  try {
    const lines = readFileSync(gitignorePath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    return (filePath: string) => {
      const rel = relative(dir, filePath);
      return lines.some((pattern) => {
        if (pattern.startsWith("!")) return false;

        const normalizedPattern = pattern.replace(/\/+$/, "");
        const relPosix = rel.replace(/\\/g, "/");
        const relBase = getBasename(relPosix);

        // Simple glob matching: exact match, prefix match, or extension match
        if (pattern.endsWith("/")) {
          return relPosix === normalizedPattern || relPosix.startsWith(normalizedPattern + "/") || relPosix.includes("/" + normalizedPattern + "/");
        }
        if (normalizedPattern.startsWith("*.")) {
          return relBase.endsWith(normalizedPattern.slice(1));
        }
        if (normalizedPattern.includes("*")) return false;
        return relPosix === normalizedPattern ||
          relBase === normalizedPattern ||
          relPosix.startsWith(normalizedPattern + "/") ||
          relPosix.includes("/" + normalizedPattern + "/") ||
          relPosix.endsWith("/" + normalizedPattern);
      });
    };
  } catch {
    return () => false;
  }
}

/**
 * Walk a directory and collect files for review, also recording every file and
 * directory that was held back and why. Respects .gitignore, skips binaries,
 * secrets, and known non-code dirs. This is what the `--dry-run` report reads.
 */
export function collectFilesDetailed(dirPath: string): CollectResult {
  const files: ReviewFile[] = [];
  const skipped: SkippedFile[] = [];
  const canonicalRoot = realpathSync(resolve(dirPath));
  const isIgnored = loadGitignore(dirPath);
  let truncated = false;

  const rel = (fullPath: string) => relative(dirPath, fullPath).replace(/\\/g, "/") || ".";

  function walk(dir: string): void {
    if (files.length >= MAX_FILES) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }

      const fullPath = join(dir, entry.name);

      // Prevent path traversal via symlinks
      let canonicalPath: string;
      try {
        canonicalPath = realpathSync(fullPath);
      } catch {
        continue; // broken symlink or inaccessible
      }
      if (!canonicalPath.startsWith(canonicalRoot)) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          skipped.push({ path: rel(fullPath) + "/", reason: "skipped-dir", detail: "build/dependency dir" });
          continue;
        }
        if (SENSITIVE_DIRS.has(entry.name) || SENSITIVE_DIRS.has(entry.name.toLowerCase())) {
          skipped.push({ path: rel(fullPath) + "/", reason: "secret", detail: "sensitive directory" });
          continue;
        }
        if (isIgnored(fullPath)) {
          skipped.push({ path: rel(fullPath) + "/", reason: "gitignored" });
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = rel(fullPath);
        if (SKIP_FILES.has(entry.name)) {
          skipped.push({ path: relPath, reason: "skip-file" });
          continue;
        }
        if (isSensitivePath(fullPath)) {
          skipped.push({ path: relPath, reason: "secret" });
          continue;
        }
        if (SKIP_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          skipped.push({ path: relPath, reason: "binary" });
          continue;
        }
        if (!isReviewablePath(entry.name)) {
          skipped.push({ path: relPath, reason: "non-reviewable" });
          continue;
        }
        if (isIgnored(fullPath)) {
          skipped.push({ path: relPath, reason: "gitignored" });
          continue;
        }

        const scan = scanFileForReview(fullPath, relPath);
        if (scan.ok) {
          files.push(scan.file);
        } else {
          skipped.push(scan.skip);
        }
      }
    }
  }

  walk(dirPath);
  return { files, skipped, truncated };
}

/**
 * Walk a directory and collect files for review.
 * Respects .gitignore, skips binaries and known non-code dirs.
 */
export function collectFiles(dirPath: string): ReviewFile[] {
  return collectFilesDetailed(dirPath).files;
}
