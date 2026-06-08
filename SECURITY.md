# Security Policy

## Supported versions

Cynical Sally CLI is distributed via npm (`@cynicalsally/cli`). Only the latest
published version is supported with security updates. Please upgrade before
reporting an issue:

```bash
npm install -g @cynicalsally/cli@latest
```

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use one of these private channels:

1. **GitHub Security Advisories** — open a private report via the repository's
   [Security tab → "Report a vulnerability"](https://github.com/w1ckedxt/cynical-sally/security/advisories/new).
2. **Email** — reach the maintainer through [cynicalsally.com/contact](https://cynicalsally.com/contact).

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal proof of concept is ideal).
- The package version (`sally --version`) and your OS / Node.js version.

You can expect an initial acknowledgement within a few days. We will keep you
informed as we work on a fix and coordinate disclosure timing with you.

## Data handling

Sally is a thin client that sends the code you explicitly select to the Sally
backend over HTTPS for analysis. Relevant security properties:

- **Source code is not stored** on the backend after analysis.
- Requests are tied to an anonymous device ID stored locally at
  `~/.sally/config.json` — not to your identity unless you link an email.
- Common credential files (`.env`, SSH keys, certificates) are skipped during
  directory scans, but you remain responsible for not submitting secrets.
- Local review artifacts may be written to `.sally/` — add it to `.gitignore`.

For the full privacy policy, see [cynicalsally.com/privacy](https://cynicalsally.com/privacy).
