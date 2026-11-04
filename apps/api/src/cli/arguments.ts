/**
 * `pnpm run bootstrap -- --flag` forwards the bare `--` to the script, and `parseArgs` would treat
 * everything after it as positional arguments. Drop a leading `--` so both spellings work.
 */
export function argumentsToParse(argv: readonly string[]): string[] {
  return argv[0] === '--' ? argv.slice(1) : [...argv];
}
