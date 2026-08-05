import { promises as fsPromises, watch, type FSWatcher } from "fs";
import path from "path";
import { pathToFileURL } from "url";

export interface LoaderOptions {
	directory: string;
	extensions?: string[];
	dev?: boolean;
}

export interface LoadedModule<T = unknown> {
	readonly filePath: string;
	readonly module: T;
}

interface ModuleCacheEntry {
	module: unknown;
	mtimeMs: number;
}

const DEFAULT_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts"];

export class Loader {
	private readonly directory: string;
	private readonly extensions: string[];
	private readonly dev: boolean;
	private readonly cache = new Map<string, ModuleCacheEntry>();
	private watcher: FSWatcher | null = null;
	private reloadCounter = 0;

	constructor(options: LoaderOptions) {
		this.directory = path.isAbsolute(options.directory) ? options.directory : path.resolve(process.cwd(), options.directory);
		this.extensions = options.extensions ?? DEFAULT_EXTENSIONS;
		this.dev = options.dev ?? false;

		if (this.dev) {
			this.createWatcher();
		}
	}

	async load(): Promise<LoadedModule[]> {
		const filePaths = await this.scanDirectory(this.directory);
		const loadedModules: LoadedModule[] = [];

		for (const filePath of filePaths) {
			const stats = await fsPromises.stat(filePath);
			const cached = this.cache.get(filePath);
			const fileChanged = !cached || stats.mtimeMs > cached.mtimeMs;
			const forceReload = this.dev && fileChanged;

			if (cached && !fileChanged) {
				loadedModules.push({ filePath, module: cached.module });
				continue;
			}

			if (cached && !this.dev && fileChanged) {
				loadedModules.push({ filePath, module: cached.module });
				continue;
			}

			const module = await this.importModule(filePath, forceReload);
			this.cache.set(filePath, { module, mtimeMs: stats.mtimeMs });
			loadedModules.push({ filePath, module });
		}

		this.removeDeletedFiles(filePaths);
		return loadedModules;
	}

	getModule(filePath: string): unknown | undefined {
		const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.directory, filePath);
		return this.cache.get(absolute)?.module;
	}

	async dispose(): Promise<void> {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	}

	clearCache(filePath?: string): void {
		if (!filePath) {
			this.cache.clear();
			return;
		}

		const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.directory, filePath);
		this.cache.delete(absolute);
	}

	private async scanDirectory(directory: string): Promise<string[]> {
		const dirents = await fsPromises.readdir(directory, { withFileTypes: true });
		const results: string[] = [];

		for (const dirent of dirents) {
			const fullPath = path.join(directory, dirent.name);

			if (dirent.isDirectory()) {
				results.push(...(await this.scanDirectory(fullPath)));
				continue;
			}

			if (!this.extensions.includes(path.extname(dirent.name))) {
				continue;
			}

			results.push(fullPath);
		}

		return results.sort();
	}

	private async importModule(filePath: string, forceReload: boolean): Promise<unknown> {
		const url = this.toFileUrl(filePath, forceReload);
		const imported = await import(url);
		return imported.default ?? imported;
	}

	private toFileUrl(filePath: string, forceReload: boolean): string {
		const fileUrl = pathToFileURL(filePath).toString();
		if (!forceReload) {
			return fileUrl;
		}

		this.reloadCounter += 1;
		return `${fileUrl}?t=${Date.now()}-${this.reloadCounter}`;
	}

	private async removeDeletedFiles(currentFiles: string[]): Promise<void> {
		for (const filePath of Array.from(this.cache.keys())) {
			if (!currentFiles.includes(filePath)) {
				this.cache.delete(filePath);
			}
		}
	}

	private createWatcher(): void {
		try {
			this.watcher = watch(
				this.directory,
				{ recursive: true, encoding: "utf8" },
				(eventType: string, filename: string | null) => {
					if (!filename) {
						return;
					}

					const changedPath = path.resolve(this.directory, filename);
					if (!this.extensions.includes(path.extname(changedPath))) {
						return;
					}

					this.cache.delete(changedPath);
				},
			);
		} catch {
			this.watcher = null;
		}
	}
}
