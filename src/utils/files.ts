import { readFileSync, statSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, relative, extname, resolve } from "node:path";

export interface ReviewFile {
  path: string;
  content: string;
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
 * Read a single file for review.
 */
export function readFileForReview(filePath: string): ReviewFile | null {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_FILE_SIZE) return null;
    if (isSensitivePath(filePath)) return null;
    if (SKIP_EXTENSIONS.has(extname(filePath).toLowerCase())) return null;
    if (SKIP_FILES.has(getBasename(filePath))) return null;

    const content = readFileSync(filePath, "utf-8");

    // Skip likely binary files (null bytes in first 512 chars)
    if (content.slice(0, 512).includes("\0")) return null;

    return { path: filePath, content };
  } catch {
    return null;
  }
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
 * Walk a directory and collect files for review.
 * Respects .gitignore, skips binaries and known non-code dirs.
 */
export function collectFiles(dirPath: string): ReviewFile[] {
  const files: ReviewFile[] = [];
  const canonicalRoot = realpathSync(resolve(dirPath));
  const isIgnored = loadGitignore(dirPath);

  function walk(dir: string): void {
    if (files.length >= MAX_FILES) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;

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
        if (SKIP_DIRS.has(entry.name)) continue;
        if (SENSITIVE_DIRS.has(entry.name) || SENSITIVE_DIRS.has(entry.name.toLowerCase())) continue;
        if (isIgnored(fullPath)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;
        if (isSensitivePath(fullPath)) continue;
        if (SKIP_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
        if (!isReviewablePath(entry.name)) continue;
        if (isIgnored(fullPath)) continue;

        const file = readFileForReview(fullPath);
        if (file) {
          file.path = relative(dirPath, fullPath);
          files.push(file);
        }
      }
    }
  }

  walk(dirPath);
  return files;
}
