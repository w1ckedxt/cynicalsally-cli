import type { ReviewFile } from "./files.js";
import { getDeviceId } from "./config.js";
import { cacheFlavor, type Flavor } from "./flavor.js";

const API_BASE = process.env.SALLY_API_URL || "https://cynicalsally-web.onrender.com";
const FETCH_TIMEOUT_MS = 120_000; // 2 minutes (Sonnet FT can take a while)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoastRequest {
  type: "code";
  files: ReviewFile[];
  mode: "quick" | "full_truth";
  tone: string;
  lang: string;
}

export interface RoastIssue {
  issue_code: string;
  severity: "critical" | "major" | "minor";
  title: string;
  description: string;
  evidence?: string[];
  fix?: string;
}

export interface RoastResponse {
  id: string;
  status: string;
  data: {
    score: number;
    issues?: RoastIssue[];
    receipts?: string[];
    actionable_fixes?: string[];
  };
  voice: {
    roast: string;
    bright_side: string;
    hardest_sneer: string;
  };
  meta: {
    lang: string;
    mode: string;
    persona?: string;
    files_reviewed: number;
    model: string;
  };
}

export type ToolName = "explain" | "review_pr" | "refactor" | "brainstorm" | "frontend_review" | "marketing_review";

export interface ToolRequest {
  tool: ToolName;
  content: string;
  lang?: string;
}

export interface ToolMessage {
  type: string;
  text: string;
}

export interface ToolResponse {
  tool: ToolName;
  data: Record<string, unknown>;
  voice: {
    roast: string;
    bright_side: string;
    hardest_sneer: string;
  };
  messages: ToolMessage[];
  meta: {
    tool: string;
    model: string;
    locale: string;
  };
  quota?: { remaining: number; limit: number };
}

export interface EntitlementsResponse {
  isSuperClub: boolean;
  tier: string | null;
  quotaRemaining: number;
  hasPrepaidGrant: boolean;
  cliTier?: "lite" | "sc";
  cliQuota?: {
    qr: { remaining: number; limit: number };
    ft: { remaining: number; limit: number };
  };
  toolQuota?: Record<string, { remaining: number; limit: number }>;
  flavor?: Flavor;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Submit code for roasting via the Render backend */
export async function submitRoast(params: RoastRequest): Promise<RoastResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/review`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, deviceId }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;

    // Use backend's Sally-voiced message when available
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as RoastResponse;
}

/** Submit a premium tool request via the Render backend */
export async function submitTool(params: ToolRequest): Promise<ToolResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/tool`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, deviceId }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as ToolResponse;
}

/** Request magic link login */
export async function requestMagicLink(email: string): Promise<{ sent: boolean; message?: string; error?: string }> {
  const deviceId = getDeviceId();
  const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, deviceId }),
  });
  return await res.json();
}

/** Check entitlements (quota, SuperClub status) + cache flavor */
export async function checkEntitlements(): Promise<EntitlementsResponse> {
  const deviceId = getDeviceId();
  const res = await fetch(`${API_BASE}/api/v1/entitlements?deviceId=${deviceId}`);
  if (!res.ok) {
    return { isSuperClub: false, tier: null, quotaRemaining: 3, hasPrepaidGrant: false };
  }
  const data = (await res.json()) as EntitlementsResponse;

  // Cache Sally's flavor text from backend
  if (data.flavor) {
    cacheFlavor(data.flavor);
  }

  return data;
}
