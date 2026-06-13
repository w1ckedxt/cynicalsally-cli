import { createRequire } from "node:module";
import { getDeviceId, hasInstallPinged, markInstallPinged } from "./config.js";
import { API_BASE } from "./api.js";

const require = createRequire(import.meta.url);
// dist/utils/install.js → ../../package.json (repo root, both local and published)
const { version } = require("../../package.json") as { version: string };

const PING_TIMEOUT_MS = 5_000;

/**
 * Fire a one-time "CLI installed" event on the first run of this install.
 *
 * - Fully fire-and-forget: never blocks or throws, never delays a command.
 * - Fires at most once per install. The flag is only set after a successful
 *   ping, so an offline first run retries on the next run instead of being
 *   lost.
 * - Sends only the install fingerprint (deviceId, version, OS, node) — never
 *   any code. The backend already defines the `CLI-INSTALL` event.
 */
export function trackInstall(): void {
  if (hasInstallPinged()) return;

  const deviceId = getDeviceId();

  fetch(`${API_BASE}/api/v1/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventCode: "CLI-INSTALL",
      deviceId,
      source: "cli",
      properties: {
        version,
        os: process.platform,
        node: process.version,
      },
    }),
    signal: AbortSignal.timeout(PING_TIMEOUT_MS),
  })
    .then((res) => {
      if (res.ok) markInstallPinged();
    })
    .catch(() => {
      // Offline or backend down — leave the flag unset so the next run retries.
    });
}
