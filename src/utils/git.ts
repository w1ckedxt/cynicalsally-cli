import { execSync } from "node:child_process";
import type { ReviewFile } from "./files.js";

/**
 * Check if we're inside a git repository.
 */
export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get staged changes as a unified diff.
 */
export function getStagedChanges(): string {
  return execSync("git diff --cached", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get unstaged (working directory) changes as a unified diff.
 */
export function getUnstagedChanges(): string {
  return execSync("git diff", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get the last commit as a unified diff.
 */
export function getLastCommitDiff(): string {
  return execSync("git diff HEAD~1..HEAD", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get branch diff (current branch vs target branch).
 */
export function getBranchDiff(branch: string): string {
  // Sanitize branch name to prevent command injection
  const safeBranch = branch.replace(/[^a-zA-Z0-9_.\-/]/g, "");
  return execSync(`git diff ${safeBranch}...HEAD`, {
    encoding: "utf-8",
    maxBuffer: 5_000_000,
  });
}

/**
 * Parse a unified diff into a files array for the API.
 *
 * Extracts the changed files and their full content from the diff.
 * For new/modified files, includes the "after" state.
 */
export function parseDiffToFiles(diff: string): ReviewFile[] {
  if (!diff.trim()) return [];

  const files: ReviewFile[] = [];
  const chunks = diff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    try {
      const headerMatch = chunk.match(/^a\/(.+?) b\/(.+)/m);
      if (!headerMatch || !headerMatch[2]) continue;

      const filePath = headerMatch[2].trim();
      if (!filePath) continue;

      // Skip deleted files and binary files
      if (chunk.includes("deleted file mode")) continue;
      if (chunk.includes("Binary files")) continue;

      const lines = chunk.split("\n");
      const contentLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("+++")) continue;
        if (line.startsWith("+")) {
          contentLines.push(line.slice(1));
        }
      }

      if (contentLines.length > 0) {
        files.push({
          path: filePath,
          content: contentLines.join("\n"),
        });
      }
    } catch {
      // Skip malformed chunks silently
      continue;
    }
  }

  return files;
}
