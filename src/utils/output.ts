import chalk from "chalk";
import type { RoastResponse, RoastIssue } from "./api.js";

// ---------------------------------------------------------------------------
// Sally ASCII Art
// ---------------------------------------------------------------------------

export function printSally(): void {
  const h = chalk.hex("#8B6914"); // hair
  const f = chalk.hex("#F5D6B8"); // skin
  const g = chalk.gray;           // glasses + blazer
  const w = chalk.white;          // eyes

  console.log(h("         ▄██████▄"));
  console.log(h("        ████████████"));
  console.log(h("       ██") + f("██████████"));
  console.log(h("       █") + f("█") + g("┌──┐") + f("██") + g("┌──┐") + f("█"));
  console.log(h("       █") + f("█") + g("│") + w("◔ ") + g("│") + f("██") + g("│") + w("◔ ") + g("│") + f("█"));
  console.log(h("        ") + f("█") + g("└──┘") + f("██") + g("└──┘") + f("█"));
  console.log("        " + f("████████████"));
  console.log("         " + f("███") + chalk.hex("#CC8888")("━") + f("████"));
  console.log("          " + g("▓▓▓▓▓▓▓▓"));
  console.log("         " + g("▓▓▓▓▓▓▓▓▓▓"));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TERMINAL_WIDTH = Math.min(process.stdout.columns || 80, 90);
const CONTENT_WIDTH = TERMINAL_WIDTH - 6; // 4 indent + 2 margin

function colorScore(score: number): string {
  const formatted = score.toFixed(1);
  if (score < 4) return chalk.red.bold(formatted);
  if (score < 7) return chalk.yellow.bold(formatted);
  return chalk.green.bold(formatted);
}

function scoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 10 - filled;
  const bar = chalk.magenta("\u2588".repeat(filled)) + chalk.gray("\u2591".repeat(empty));
  return `[${bar}]`;
}

function colorSeverity(severity: string): string {
  switch (severity) {
    case "critical": return chalk.red.bold("CRITICAL");
    case "major": return chalk.yellow.bold("MAJOR");
    case "minor": return chalk.gray("minor");
    default: return chalk.gray(severity);
  }
}

/** Highlight `backtick` code references in cyan */
function highlightCode(text: string): string {
  return text.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(`\`${code}\``));
}

/** Wrap text to fit terminal width, preserving indent */
function wrapText(text: string, indent: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    // Strip chalk codes for length calculation
    const plainCurrent = current.replace(/\x1b\[[0-9;]*m/g, "");
    const plainWord = word.replace(/\x1b\[[0-9;]*m/g, "");

    if (plainCurrent.length + plainWord.length + 1 > width && current) {
      lines.push(indent + current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(indent + current);
  return lines;
}

function divider(): void {
  console.log(chalk.gray("  " + "\u2500".repeat(Math.min(56, TERMINAL_WIDTH - 4))));
}

function printWrapped(text: string, indent = "    ", color = chalk.white): void {
  const highlighted = highlightCode(text);
  const lines = wrapText(highlighted, "", CONTENT_WIDTH);
  for (const line of lines) {
    console.log(color(indent + line));
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function displayRoast(response: RoastResponse): void {
  const { data, voice, meta } = response;

  // Header
  console.log(chalk.magenta.bold("  \u2620  SALLY'S CODE REVIEW"));
  console.log(chalk.gray(`  ${meta.mode === "full_truth" ? "Full Truth" : "Quick Roast"} \u2022 ${meta.files_reviewed} file${meta.files_reviewed !== 1 ? "s" : ""} reviewed \u2022 ${meta.model || "claude"}`));
  console.log();

  // Score
  console.log(`  ${chalk.gray("Score:")} ${colorScore(data.score)}/10  ${scoreBar(data.score)}`);
  console.log();
  divider();
  console.log();

  // Parse roast into sections (first = intro, last = verdict, middle = observations)
  const paragraphs = voice.roast.split("\n\n").filter((p) => p.trim());

  if (paragraphs.length > 0) {
    // Intro — Sally's opening take
    printWrapped(paragraphs[0], "  ", chalk.white.italic);
    console.log();

    // Observations — numbered, with visual distinction
    const observations = paragraphs.slice(1, -1);
    if (observations.length > 0) {
      divider();
      console.log();

      for (let i = 0; i < observations.length; i++) {
        const num = chalk.magenta.bold(`  ${i + 1}.`);
        const lines = wrapText(highlightCode(observations[i]), "", CONTENT_WIDTH);
        // First line with number
        if (lines.length > 0) {
          console.log(`${num} ${chalk.white(lines[0])}`);
        }
        // Remaining lines indented
        for (let j = 1; j < lines.length; j++) {
          console.log(chalk.white(`     ${lines[j]}`));
        }
        console.log();
      }
    }

    // Final verdict
    if (paragraphs.length > 1) {
      divider();
      console.log();
      console.log(chalk.gray("  VERDICT"));
      console.log();
      printWrapped(paragraphs[paragraphs.length - 1], "  ", chalk.white.bold);
      console.log();
    }
  }

  // Issues (full_truth mode)
  if (data.issues && data.issues.length > 0) {
    divider();
    console.log();
    console.log(chalk.magenta.bold("  TOP ISSUES"));
    console.log();

    for (let i = 0; i < data.issues.length; i++) {
      const issue = data.issues[i] as RoastIssue;
      console.log(`  ${chalk.white.bold(`${i + 1}.`)} ${colorSeverity(issue.severity)} ${chalk.cyan(issue.issue_code)}`);
      console.log(`     ${chalk.white.bold(issue.title)}`);
      printWrapped(issue.description, "     ", chalk.gray);

      if (issue.evidence && issue.evidence.length > 0) {
        for (const e of issue.evidence) {
          console.log(`     ${chalk.yellow("\u2192")} ${chalk.gray(highlightCode(e))}`);
        }
      }

      if (issue.fix) {
        console.log(`     ${chalk.green("\u2713")} ${chalk.green(highlightCode(issue.fix))}`);
      }
      console.log();
    }
  }

  // Actionable fixes
  if (data.actionable_fixes && data.actionable_fixes.length > 0) {
    divider();
    console.log();
    console.log(chalk.green.bold("  ACTIONABLE FIXES"));
    console.log();
    for (const fix of data.actionable_fixes) {
      printWrapped(`\u2713 ${fix}`, "  ", chalk.green);
    }
    console.log();
  }

  // Bright side & hardest sneer
  divider();
  console.log();
  if (voice.bright_side) {
    printWrapped(`\u2728 ${voice.bright_side}`, "  ", chalk.green.italic);
  }
  if (voice.hardest_sneer) {
    console.log();
    printWrapped(`\uD83D\uDD25 ${voice.hardest_sneer}`, "  ", chalk.red.bold);
  }
  console.log();
}
