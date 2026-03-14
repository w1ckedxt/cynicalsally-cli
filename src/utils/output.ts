import chalk from "chalk";
import type { RoastResponse, RoastIssue } from "./api.js";

// ---------------------------------------------------------------------------
// Score coloring
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Severity coloring
// ---------------------------------------------------------------------------

function colorSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red.bold("CRITICAL");
    case "major":
      return chalk.yellow.bold("MAJOR");
    case "minor":
      return chalk.gray("minor");
    default:
      return chalk.gray(severity);
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function displayRoast(response: RoastResponse): void {
  const { data, voice, meta } = response;

  // Header
  console.log();
  console.log(chalk.magenta.bold("  \u2620  SALLY'S CODE REVIEW"));
  console.log(chalk.gray(`  ${meta.mode === "full_truth" ? "Full Truth" : "Quick Roast"} \u2022 ${meta.files_reviewed} file${meta.files_reviewed !== 1 ? "s" : ""} reviewed`));
  console.log();

  // Score
  console.log(`  ${chalk.gray("Score:")} ${colorScore(data.score)}/10  ${scoreBar(data.score)}`);
  console.log();

  // Divider
  console.log(chalk.gray("  " + "\u2500".repeat(56)));
  console.log();

  // Roast text
  const roastLines = voice.roast.split("\n\n");
  for (const line of roastLines) {
    console.log(chalk.white(`  ${line}`));
    console.log();
  }

  // Issues (full_truth mode)
  if (data.issues && data.issues.length > 0) {
    console.log(chalk.gray("  " + "\u2500".repeat(56)));
    console.log();
    console.log(chalk.magenta.bold("  TOP ISSUES"));
    console.log();

    for (let i = 0; i < data.issues.length; i++) {
      const issue = data.issues[i] as RoastIssue;
      console.log(`  ${chalk.white.bold(`${i + 1}.`)} ${colorSeverity(issue.severity)} ${chalk.cyan(issue.issue_code)}`);
      console.log(`     ${chalk.white.bold(issue.title)}`);
      console.log(`     ${chalk.gray(issue.description)}`);

      if (issue.evidence && issue.evidence.length > 0) {
        for (const e of issue.evidence) {
          console.log(`     ${chalk.yellow("\u2192")} ${chalk.gray(e)}`);
        }
      }

      if (issue.fix) {
        console.log(`     ${chalk.green("\u2713")} ${chalk.green(issue.fix)}`);
      }
      console.log();
    }
  }

  // Actionable fixes
  if (data.actionable_fixes && data.actionable_fixes.length > 0) {
    console.log(chalk.gray("  " + "\u2500".repeat(56)));
    console.log();
    console.log(chalk.green.bold("  ACTIONABLE FIXES"));
    console.log();
    for (const fix of data.actionable_fixes) {
      console.log(`  ${chalk.green("\u2713")} ${fix}`);
    }
    console.log();
  }

  // Bright side & hardest sneer
  console.log(chalk.gray("  " + "\u2500".repeat(56)));
  console.log();
  if (voice.bright_side) {
    console.log(`  ${chalk.green("\u2728")} ${chalk.italic(voice.bright_side)}`);
  }
  if (voice.hardest_sneer) {
    console.log(`  ${chalk.red("\uD83D\uDD25")} ${chalk.bold(voice.hardest_sneer)}`);
  }
  console.log();
}
