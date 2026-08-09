import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

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
  zi --help

Commands:
  create    Scaffold a new @ziji/server project with startup/, routes/, and src/
`);
}

type PackageManager = "pnpm" | "npm";

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function readPackageJson(directory: string): PackageJson {
	const packageJsonPath = join(directory, "package.json");

	if (!existsSync(packageJsonPath)) {
		throw new Error(`package.json not found in ${directory}`);
	}

	return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
}

function isPackageDeclared(packageJson: PackageJson, packageName: string): boolean {
	return Boolean(packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]);
}

function isPackageInstalled(directory: string, packageName: string): boolean {
	return existsSync(join(directory, "node_modules", ...packageName.split("/")));
}

function detectPackageManager(directory: string): PackageManager {
	if (existsSync(join(directory, "pnpm-lock.yaml"))) {
		return "pnpm";
	}

	if (existsSync(join(directory, "package-lock.json"))) {
		return "npm";
	}

	return "pnpm";
}

function runPackageManager(manager: PackageManager, args: readonly string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const command = manager === "pnpm" ? "pnpm" : "npm";
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: process.platform === "win32",
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to run ${command}. Make sure ${command} is installed and available in PATH.`));
		});

		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
		});
	});
}

async function ensurePackageInstalled(directory: string, packageName: string): Promise<void> {
	const packageJson = readPackageJson(directory);

	if (isPackageInstalled(directory, packageName)) {
		return;
	}

	const manager = detectPackageManager(directory);

	if (isPackageDeclared(packageJson, packageName)) {
		console.log(`Installing ${packageName}...`);

		await runPackageManager(manager, manager === "pnpm" ? ["install"] : ["install"], directory);

		return;
	}

	console.log(`Installing ${packageName}...`);

	await runPackageManager(manager, manager === "pnpm" ? ["add", packageName] : ["install", packageName], directory);
}

async function ensureZijiPackages(directory: string): Promise<void> {
	/*
	 * @ziji/server is the normal entry package for a generated project.
	 * @ziji/core should only be installed directly when the project already
	 * declares it. @ziji/server is responsible for bringing core transitively.
	 */
	await ensurePackageInstalled(directory, "@ziji/server");

	const packageJson = readPackageJson(directory);

	if (isPackageDeclared(packageJson, "@ziji/core")) {
		await ensurePackageInstalled(directory, "@ziji/core");
	}
}

export async function runCli(argv: readonly string[]): Promise<number> {
	const parsed = parseCliArgs(argv);

	if (parsed.command === "help" || parsed.flags.help || parsed.flags.h) {
		printHelp();
		return 0;
	}

	if (!parsed.command) {
		printHelp();
		return 0;
	}

	if (parsed.command === "create") {
		if (parsed.flags.help || parsed.flags.h) {
			console.log(`@ziji/cli create

Usage:
  zi create <directory> [--name <package-name>] [--force]

Options:
  --name <package-name>  Package name
  --force                Overwrite an existing project
  --help, -h             Show this help
`);
			return 0;
		}

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

			await ensureZijiPackages(result.targetDirectory);

			console.log("Project is ready.");
			console.log("Next steps:");
			console.log(`  cd ${targetDirectory === "." ? "." : targetDirectory}`);
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
