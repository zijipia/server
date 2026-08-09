import path from "path";
import { Loader, type LoadedModule, type LoaderOptions } from "./loader";

export type StartupHandler = () => void | Promise<void>;

export interface StartupModuleExports {
	readonly priority?: number;
	readonly default?: StartupHandler;
}

export interface RunStartupOptions {
	directory: string;
	dev?: boolean;
	extensions?: LoaderOptions["extensions"];
	loader?: Loader;
}

export interface RunStartupResult {
	readonly loader: Loader;
	readonly loaded: LoadedModule<Record<string, unknown>>[];
	readonly executed: readonly string[];
}

const DEFAULT_PRIORITY = 1000;

export function resolveStartupPriority(filePath: string, moduleExports: Record<string, unknown>): number {
	const exportedPriority = moduleExports.priority;
	if (typeof exportedPriority === "number" && Number.isFinite(exportedPriority)) {
		return exportedPriority;
	}

	const filenameMatch = path.basename(filePath).match(/^(\d+)-/);
	if (filenameMatch) {
		return Number.parseInt(filenameMatch[1], 10);
	}

	return DEFAULT_PRIORITY;
}

export function resolveStartupHandler(moduleExports: Record<string, unknown>): StartupHandler | undefined {
	const defaultExport = moduleExports.default;
	if (typeof defaultExport === "function") {
		return defaultExport as StartupHandler;
	}

	return undefined;
}

export async function runStartup(options: RunStartupOptions): Promise<RunStartupResult> {
	const loader =
		options.loader ??
		new Loader({
			directory: options.directory,
			dev: options.dev,
			extensions: options.extensions,
			loadMode: "namespace",
		});

	const loaded = (await loader.load()) as LoadedModule<Record<string, unknown>>[];
	const sorted = [...loaded].sort((left, right) => {
		const leftPriority = resolveStartupPriority(left.filePath, left.module);
		const rightPriority = resolveStartupPriority(right.filePath, right.module);

		if (leftPriority !== rightPriority) {
			return leftPriority - rightPriority;
		}

		return left.filePath.localeCompare(right.filePath);
	});

	const executed: string[] = [];

	for (const entry of sorted) {
		const handler = resolveStartupHandler(entry.module);
		if (!handler) {
			continue;
		}

		await handler();
		executed.push(entry.filePath);
	}

	return { loader, loaded, executed };
}
