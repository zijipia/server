import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";

import { defaultName, getMatchedExtension, normalizeExtensions, toError } from "./utils.js";
import { createDebug } from "./debug.js";
import { ModuleLoader } from "./module-loader.js";
import { EventManager } from "./events.js";
import { LoaderWatcher } from "./watcher.js";
import type {
	ExtensionDefinition,
	LoadOptions,
	LoadResult,
	LoadedModule,
	LoaderContext,
	LoaderEvents,
	LoaderOptions,
} from "./types.js";
import type { WatchEvent } from "./watcher.js";

const DEFAULT_EXTENSIONS = [".js", ".cjs", ".mjs"];
export interface Loader<T = unknown> {
	on<K extends keyof LoaderEvents<T>>(event: K, listener: (...args: LoaderEvents<T>[K]) => void): this;
	once<K extends keyof LoaderEvents<T>>(event: K, listener: (...args: LoaderEvents<T>[K]) => void): this;
	off<K extends keyof LoaderEvents<T>>(event: K, listener: (...args: LoaderEvents<T>[K]) => void): this;
	emit<K extends keyof LoaderEvents<T>>(event: K, ...args: LoaderEvents<T>[K]): boolean;
}

export class Loader<T = unknown> extends EventEmitter {
	private readonly modules = new Map<string, LoadedModule<T>>();
	private readonly definitions = new Map<string, ExtensionDefinition<T>>();
	private readonly moduleLoader: ModuleLoader;
	private readonly eventManager = new EventManager<T>();
	private readonly watcher: LoaderWatcher;
	private readonly watched = new Set<string>();
	private readonly watchRoots = new Map<string, LoadOptions<T>>();
	private readonly options: Required<Pick<LoaderOptions<T>, "recursive" | "throwOnError">> & LoaderOptions<T>;
	private readonly debug: ReturnType<typeof createDebug>;

	public constructor(options: LoaderOptions<T> = {}) {
		super();
		this.options = {
			recursive: options.recursive ?? true,
			throwOnError: options.throwOnError ?? true,
			...options,
			extensions: normalizeExtensions(options.extensions ?? DEFAULT_EXTENSIONS),
		};
		this.debug = createDebug(this.options.debug, "Loader");
		this.moduleLoader = new ModuleLoader(this.options.debug);
		this.watcher = new LoaderWatcher({
			recursive: this.options.recursive,
			debounce: options.debounce ?? 100,
			ignore: options.ignore,
		});
		this.debug("created", {
			recursive: this.options.recursive,
			throwOnError: this.options.throwOnError,
			extensions: this.options.extensions,
			watch: this.options.watch ?? false,
		});
	}

	public define(definition: ExtensionDefinition<T>): this {
		const extension = definition.extension.startsWith(".") ? definition.extension : `.${definition.extension}`;
		this.definitions.set(extension.toLowerCase(), { ...definition, extension });
		this.debug("definition registered", { extension, customLoader: Boolean(definition.load) });
		return this;
	}

	public async load(target: string, options: LoadOptions<T> = {}): Promise<LoadResult<T>> {
		const absolute = path.resolve(target);
		this.debug("load requested", { target, absolute, watch: options.watch ?? this.options.watch });

		try {
			const stat = await fs.stat(absolute);
			if (stat.isDirectory()) {
				this.debug("loading directory", { absolute });
				const result = await this.loadDirectory(absolute, options);
				if (options.watch ?? this.options.watch) this.watch(absolute, options);
				this.debug("directory loaded", { absolute, loaded: result.loaded.length, failed: result.failed.length });
				return result;
			}

			const loaded = await this.loadFile(path.dirname(absolute), absolute, options);
			if (loaded && (options.watch ?? this.options.watch)) this.watch(absolute, options);
			this.debug("file loaded", { absolute, name: loaded?.name });
			return { loaded: loaded ? [loaded] : [], failed: [] };
		} catch (error) {
			const normalized = toError(error);
			this.debug("load failed", { absolute, error: normalized });
			this.emitError(normalized, absolute);
			if (options.throwOnError ?? this.options.throwOnError) throw normalized;
			return { loaded: [], failed: [{ path: absolute, error: normalized }] };
		}
	}

	public get(name: string): T | undefined {
		return this.modules.get(name)?.module;
	}

	public getLoaded(name: string): LoadedModule<T> | undefined {
		return this.modules.get(name);
	}

	public has(name: string): boolean {
		return this.modules.has(name);
	}

	public keys(): string[] {
		return [...this.modules.keys()];
	}

	public values(): T[] {
		return [...this.modules.values()].map((entry) => entry.module);
	}

	public entries(): Array<[string, T]> {
		return [...this.modules.entries()].map(([name, entry]) => [name, entry.module]);
	}

	public async unload(name: string): Promise<boolean> {
		const loaded = this.modules.get(name);
		if (!loaded) {
			this.debug("unload skipped; module not found", { name });
			return false;
		}

		this.debug("unloading", { name, path: loaded.path });
		this.eventManager.unbind(loaded);
		loaded.controller.abort();
		this.modules.delete(name);
		this.moduleLoader.invalidate(loaded.path);
		this.emit("unload", loaded);
		this.debug("unloaded", { name });
		return true;
	}

	public async reload(name: string): Promise<LoadedModule<T>> {
		this.debug("reload requested", { name });
		const old = this.modules.get(name);
		if (!old) throw new Error(`Module "${name}" is not loaded.`);

		const options = { ...old.options, name: old.name };
		let candidate: LoadedModule<T> | undefined;

		try {
			candidate = await this.loadFile(old.context.root, old.path, options, true, false);
			if (!candidate) throw new Error(`Failed to reload "${name}".`);

			this.eventManager.bind(
				candidate,
				options.events ?? this.options.events,
				options.on ?? this.options.on,
				options.once ?? this.options.once,
			);

			// Atomic swap: old stays live until the replacement is fully ready.
			this.eventManager.unbind(old);
			old.controller.abort();
			this.modules.set(name, candidate);
			this.moduleLoader.invalidate(old.path);

			this.emit("reload", candidate);
			this.debug("reloaded", { name, path: candidate.path });
			return candidate;
		} catch (error) {
			this.debug("reload failed", { name, error });
			if (candidate) {
				this.eventManager.unbind(candidate);
				candidate.controller.abort();
			}
			throw error;
		}
	}

	public unwatch(target: string): boolean {
		const absolute = path.resolve(target);
		const result = this.watcher.unwatch(absolute);
		if (!result) return false;
		this.watched.delete(absolute);
		this.watchRoots.delete(absolute);
		this.emit("unwatch", absolute);
		this.debug("unwatched", { target: absolute });
		return true;
	}

	public async clear(): Promise<void> {
		this.debug("clearing", { count: this.modules.size });
		for (const name of this.keys()) await this.unload(name);
	}

	public async destroy(): Promise<void> {
		this.debug("destroying", { modules: this.modules.size, watched: this.watched.size });
		await this.clear();
		this.watcher.close();
		this.watched.clear();
		this.watchRoots.clear();
		this.debug("destroyed");
	}

	private async loadDirectory(root: string, options: LoadOptions<T>): Promise<LoadResult<T>> {
		const loaded: LoadedModule<T>[] = [];
		const failed: Array<{ path: string; error: Error }> = [];
		await this.scanDirectory(root, root, options, loaded, failed);
		return { loaded, failed };
	}

	private async scanDirectory(
		root: string,
		directory: string,
		options: LoadOptions<T>,
		loaded: LoadedModule<T>[],
		failed: Array<{ path: string; error: Error }>,
	): Promise<void> {
		const entries = await fs.readdir(directory, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		this.debug("scanning directory", { root, directory, entries: entries.length });

		const tasks = entries.map(async (entry) => {
			const filePath = path.join(directory, entry.name);
			if (this.options.ignore?.(filePath, entry.isDirectory())) {
				this.debug("ignored", { path: filePath, directory: entry.isDirectory() });
				return;
			}

			if (entry.isDirectory()) {
				if (options.recursive ?? this.options.recursive) {
					await this.scanDirectory(root, filePath, options, loaded, failed);
				}
				return;
			}

			if (!this.isLoadable(filePath)) return;

			try {
				const result = await this.loadFile(root, filePath, options);
				if (result) loaded.push(result);
			} catch (error) {
				const normalized = toError(error);
				failed.push({ path: filePath, error: normalized });
				this.emitError(normalized, filePath);
				if (options.throwOnError ?? this.options.throwOnError) throw normalized;
			}
		});

		await Promise.all(tasks);
	}

	private async loadFile(
		root: string,
		filePath: string,
		options: LoadOptions<T>,
		reload = false,
		register = true,
	): Promise<LoadedModule<T> | undefined> {
		const extension = getMatchedExtension(filePath, this.options.extensions!);
		if (!extension) return undefined;

		const definition = this.definitions.get(extension.toLowerCase());
		this.debug("loading file", { root, filePath, extension, reload, register });
		const module = (await this.moduleLoader.load(filePath, definition, reload)) as T;
		const relativePath = path.relative(root, filePath);
		const name = this.resolveName(root, filePath, relativePath, module, options);
		this.debug("resolved module", { filePath, relativePath, name });
		const controller = new AbortController();
		const context: LoaderContext<T> = {
			name,
			path: filePath,
			root,
			module,
			loader: this,
			signal: controller.signal,
		};

		try {
			const check = options.check ?? definition?.check ?? this.options.check;
			if (check) {
				this.debug("checking module", { name });
				if (!(await check(module, context))) throw new Error(`Module "${name}" failed validation.`);
			}

			const loaded: LoadedModule<T> = {
				name,
				path: filePath,
				module,
				context,
				options: { ...options },
				controller,
				initialized: false,
			};

			const init = options.init ?? definition?.init ?? this.options.init;
			if (init) {
				this.debug("initializing module", { name });
				if (typeof init === "function") await init(module, context);
				else if (typeof (module as any)?.init === "function") await (module as any).init(context);
				loaded.initialized = true;
			}

			if (register) {
				this.modules.set(name, loaded);
				try {
					this.eventManager.bind(
						loaded,
						options.events ?? this.options.events,
						options.on ?? this.options.on,
						options.once ?? this.options.once,
					);
				} catch (error) {
					this.modules.delete(name);
					controller.abort();
					throw error;
				}
				this.emit("load", loaded);
				this.debug("module registered", { name, path: filePath });
			}

			return loaded;
		} catch (error) {
			controller.abort();
			this.debug("loadFile failed", { filePath, name, error });
			throw error;
		}
	}

	private resolveName(root: string, filePath: string, relativePath: string, module: T, options: LoadOptions<T>): string {
		const resolver = options.name ?? this.options.name;
		if (typeof resolver === "string") return resolver;
		if (typeof resolver === "function") {
			return resolver(filePath, {
				root,
				relativePath,
				extension: path.extname(filePath),
				module,
			});
		}
		return defaultName(root, filePath);
	}

	private isLoadable(filePath: string): boolean {
		return Boolean(getMatchedExtension(filePath, this.options.extensions!));
	}

	private watch(target: string, options: LoadOptions<T>): void {
		const absolute = path.resolve(target);
		if (this.watched.has(absolute)) return;

		this.watched.add(absolute);
		this.watchRoots.set(absolute, { ...options });
		this.watcher.watch(absolute, (filePath, event) => {
			this.emit("change", filePath);
			void this.handleWatchChange(filePath, event);
		});
		this.emit("watch", absolute);
		this.debug("watching", { target: absolute });
	}

	private async handleWatchChange(filePath: string, event: WatchEvent): Promise<void> {
		this.debug("watch change", { filePath, event });
		if (!this.isLoadable(filePath)) return;

		const existing = [...this.modules.values()].find((module) => path.resolve(module.path) === path.resolve(filePath));
		const exists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false);
		this.debug("watch change state", { filePath, existing: existing?.name, exists });

		if (!exists) {
			if (existing) await this.unload(existing.name);
			return;
		}

		if (existing) {
			try {
				await this.reload(existing.name);
			} catch (error) {
				this.debug("watch reload failed", { filePath, name: existing.name, error });
				this.emitError(toError(error), filePath);
			}
			return;
		}

		const root = this.findWatchRoot(filePath);
		if (!root) return;

		const options = this.watchRoots.get(root) ?? {};
		try {
			let loadRoot = root;
			try {
				const stat = await fs.stat(root);
				if (!stat.isDirectory()) loadRoot = path.dirname(root);
			} catch {
				loadRoot = path.dirname(root);
			}
			await this.loadFile(loadRoot, filePath, options);
		} catch (error) {
			this.debug("watch load failed", { filePath, error });
			this.emitError(toError(error), filePath);
		}
	}

	private findWatchRoot(filePath: string): string | undefined {
		const roots = [...this.watchRoots.keys()].sort((a, b) => b.length - a.length);
		return roots.find((root) => filePath === root || filePath.startsWith(root + path.sep));
	}

	private emitError(error: Error, filePath: string): void {
		this.debug("error", { filePath, error });
		if (this.listenerCount("error") > 0) this.emit("error", error, filePath);
	}
}
