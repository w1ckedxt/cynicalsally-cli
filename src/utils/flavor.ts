import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SALLY_DIR = join(homedir(), ".sally");
const FLAVOR_CACHE = join(SALLY_DIR, "flavor.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface Flavor {
  spinner_quick: string;
  spinner_ft: string;
  bg_prompt: string;
  bg_confirmed: string;
  bg_results_hint: string;
  quota_exhausted_qr: string;
  quota_exhausted_ft: string;
  usage_spinner: string;
  usage_sc_greeting: string;
  usage_free_upsell: string;
  usage_anonymous: string;
  login_spinner: string;
  login_success: string;
  login_already: string;
  login_invalid_email: string;
  login_failed: string;
  logout_done: string;
  logout_not_logged_in: string;
  upgrade_already_sc: string;
  upgrade_opening: string;
  upgrade_waiting: string;
  upgrade_success: string;
  error_network: string;
  error_generic: string;
  no_files: string;
  no_staged: string;
  no_diff: string;
  no_path: string;
  scanning_dir: string;
  found_staged: string;
  found_unstaged: string;
  found_last_commit: string;
  report_saved: string;
  fail_under: string;

  // Premium tools
  tool_spinner_explain: string;
  tool_spinner_review_pr: string;
  tool_spinner_refactor: string;
  tool_spinner_brainstorm: string;
  tool_spinner_frontend: string;
  tool_spinner_marketing: string;
  tool_quota_exhausted: string;
}

/** Bare-bones fallbacks — intentionally bland. Sally's real voice is on the backend. */
const FALLBACK: Flavor = {
  spinner_quick: "Scanning...",
  spinner_ft: "Analyzing...",
  bg_prompt: "Press B to background this, or any key to wait...",
  bg_confirmed: "Running in the background.",
  bg_results_hint: "Run sally results to see the verdict.",
  quota_exhausted_qr: "Monthly limit reached.",
  quota_exhausted_ft: "Full Truth requires the Full Suite.",
  usage_spinner: "Checking account...",
  usage_sc_greeting: "Full Suite active.",
  usage_free_upsell: "Run sally upgrade for more.",
  usage_anonymous: "Not logged in.",
  login_spinner: "Sending magic link...",
  login_success: "Check your inbox.",
  login_already: "Already logged in.",
  login_invalid_email: "Invalid email.",
  login_failed: "Failed to send.",
  logout_done: "Logged out.",
  logout_not_logged_in: "Not logged in.",
  upgrade_already_sc: "Already Full Suite.",
  upgrade_opening: "Opening Full Suite...",
  upgrade_waiting: "Waiting for upgrade...",
  upgrade_success: "Full Suite activated.",
  error_network: "Network error.",
  error_generic: "Something went wrong.",
  no_files: "No files found.",
  no_staged: "Nothing staged.",
  no_diff: "No diff found.",
  no_path: "Path not found.",
  scanning_dir: "Scanning directory...",
  found_staged: "Found staged changes.",
  found_unstaged: "Found uncommitted changes.",
  found_last_commit: "Roasting last commit.",
  report_saved: "Saved to",
  fail_under: "Below threshold.",
  tool_spinner_explain: "Reading your code...",
  tool_spinner_review_pr: "Reviewing PR...",
  tool_spinner_refactor: "Analyzing for refactoring...",
  tool_spinner_brainstorm: "Thinking about your idea...",
  tool_spinner_frontend: "Inspecting frontend...",
  tool_spinner_marketing: "Reading your copy...",
  tool_quota_exhausted: "Tool limit reached.",
};

interface CachedFlavor {
  flavor: Flavor;
  cachedAt: number;
}

/** Get cached flavor or return bland fallback */
export function getFlavor(): Flavor {
  try {
    if (existsSync(FLAVOR_CACHE)) {
      const cached: CachedFlavor = JSON.parse(readFileSync(FLAVOR_CACHE, "utf-8"));
      if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.flavor;
      }
    }
  } catch {
    // Cache corrupt — fall through
  }
  return FALLBACK;
}

/** Save flavor from API response to cache */
export function cacheFlavor(flavor: Flavor): void {
  try {
    if (!existsSync(SALLY_DIR)) {
      mkdirSync(SALLY_DIR, { recursive: true });
    }
    const cached: CachedFlavor = { flavor, cachedAt: Date.now() };
    writeFileSync(FLAVOR_CACHE, JSON.stringify(cached), { mode: 0o600 });
  } catch {
    // Non-critical
  }
}
