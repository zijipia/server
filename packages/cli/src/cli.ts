import { createProject } from "./commands/create.js";

export interface ParsedCliArgs {
	readonly command?: string;
	readonly positional: readonly string[];
	readonly flags: Readonly<Record<string, string | boolean>>;
}

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg.startsWith("--")) {
			const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
			if (inlineValue !== undefined) {
				flags[rawKey] = inlineValue;
				continue;
			}

			const next = argv[index + 1];
			if (next && !next.startsWith("-")) {
				flags[rawKey] = next;
				index += 1;
				continue;
			}

			flags[rawKey] = true;
			continue;
		}

		if (arg.startsWith("-") && arg.length > 1) {
			flags[arg.slice(1)] = true;
			continue;
		}

		positional.push(arg);
	}

	const [command, ...rest] = positional;

	return {
		command,
		positional: rest,
		flags,
	};
}

function printHelp(): void {
	console.log(`@ziji/cli

Usage:
  zi create <directory> [--name <package-name>] [--force]
  zi help
  zi --help

Commands:
  create    Scaffold a new @ziji/server project with startup/, routes/, and src/
  help      Show this help message
`);
}

function printCreateHelp(): void {
	console.log(`@ziji/cli create

Usage:
  zi create <directory> [--name <package-name>] [--force]

Options:
  --name <package-name>  Set the package name (defaults to the directory name)
  --force                Allow creating the project in a non-empty directory
  -h, --help             Show this help message
`);
}

export async function runCli(argv: readonly string[]): Promise<number> {
	const parsed = parseCliArgs(argv);

	// Command-specific help must be handled before global help.
	if (parsed.command === "create" && (parsed.flags.help === true || parsed.flags.h === true)) {
		printCreateHelp();
		return 0;
	}

	// Global help: `zi --help`, `zi -h`, or `zi help`.
	if (parsed.command === "help" || parsed.flags.help === true || parsed.flags.h === true) {
		printHelp();
		return 0;
	}

	// Running `zi` without a command shows help and succeeds.
	if (!parsed.command) {
		printHelp();
		return 0;
	}

	if (parsed.command === "create") {
		const targetDirectory = parsed.positional[0];
		if (!targetDirectory) {
			console.error("@ziji/cli create: missing target directory. Example: zi create my-app");
			return 1;
		}

		const name =
			(typeof parsed.flags.name === "string" && parsed.flags.name) ||
			(targetDirectory === "." ? pathBasename(process.cwd()) : pathBasename(targetDirectory));

		try {
			const result = await createProject({
				targetDirectory,
				name,
				force: parsed.flags.force === true,
			});

			console.log(`Created @ziji/server project at ${result.targetDirectory}`);
			console.log("Next steps:");
			console.log(`  cd ${targetDirectory === "." ? "." : targetDirectory}`);
			console.log("  pnpm install");
			console.log("  pnpm dev");
			return 0;
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			return 1;
		}
	}

	console.error(`@ziji/cli: unknown command "${parsed.command}". Run zi --help for usage.`);
	return 1;
}

function pathBasename(value: string): string {
	const normalized = value.replace(/[\\/]+$/, "");
	const segments = normalized.split(/[\\/]/);
	return segments[segments.length - 1] || "ziji-app";
}
