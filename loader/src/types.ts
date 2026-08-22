import type { EventEmitter } from "node:events";
import type { Loader } from "./loader.js";
export type MaybePromise<T> = T | Promise<T>;

export type ModuleNameResolver<T = unknown> = (filePath: string, context: NameResolverContext<T>) => string;

export interface NameResolverContext<T = unknown> {
	root: string;
	relativePath: string;
	extension: string;
	module: T;
}

export type ModuleCheck<T> = (module: T, context: LoaderContext<T>) => MaybePromise<boolean>;

export type ModuleInit<T> = (module: T, context: LoaderContext<T>) => MaybePromise<void>;

export interface LoaderContext<T> {
	readonly name: string;
	readonly path: string;
	readonly root: string;
	readonly module: T;
	readonly loader: Loader<T>;
	readonly signal: AbortSignal;
	readonly controller: AbortController;
}

export interface LoadedModule<T> {
	readonly name: string;
	readonly path: string;
	readonly module: T;
	readonly context: LoaderContext<T>;
	readonly options?: LoadOptions<T>;

	initialized: boolean;
}

export interface ExtensionDefinition<T = unknown> {
	/**
	 * Extension this definition handles.
	 *
	 * Example:
	 * ".js"
	 * ".plugin.js"
	 */
	extension: string;

	/**
	 * Custom loader.
	 *
	 * If omitted, Loader will use its default
	 * CommonJS / ESM loader.
	 */
	load?: (filePath: string, context: LoaderFileContext) => MaybePromise<unknown>;

	check?: ModuleCheck<T>;

	init?: boolean | ModuleInit<T>;
}

export interface LoaderFileContext {
	readonly path: string;
	readonly extension: string;
}

export interface LoaderOptions<T = unknown> extends WatchOptions {
	recursive?: boolean;

	extensions?: string[];

	ignore?: (path: string, isDirectory: boolean) => boolean;

	name?: string | ModuleNameResolver<T>;

	check?: ModuleCheck<T>;

	init?: boolean | ModuleInit<T>;

	throwOnError?: boolean;

	/**
	 * Event target used by on/once.
	 */
	events?: EventTarget;

	/**
	 * Automatically bind events.
	 */
	on?: EventMapDefinition;

	/**
	 * Automatically bind one-time events.
	 */
	once?: EventMapDefinition;
}

export interface LoadOptions<T = unknown> extends Partial<LoaderOptions<T>> {
	name?: string | ModuleNameResolver<T>;

	init?: boolean | ModuleInit<T>;

	check?: ModuleCheck<T>;

	on?: EventMapDefinition;

	once?: EventMapDefinition;
}


export interface LoaderEvents<T = unknown> {
	load: [LoadedModule<T>];
	unload: [LoadedModule<T>];
	reload: [LoadedModule<T>];
	error: [Error, string];
}

export type EventMap = Record<string, unknown[]>;

export interface LoaderEventEmitter {
	on<E extends string>(event: E, listener: (...args: any[]) => void): this;

	once<E extends string>(event: E, listener: (...args: any[]) => void): this;

	off<E extends string>(event: E, listener: (...args: any[]) => void): this;
}

export interface LoadResult<T> {
	loaded: LoadedModule<T>[];
	failed: Array<{
		path: string;
		error: Error;
	}>;
}

export type EventHandler<T = unknown> = string | ((...args: any[]) => unknown);

export type EventTarget = EventEmitter;

export interface EventBinding {
	event: string;
	handler: (...args: any[]) => unknown;
	once: boolean;
	target: EventTarget;
}

export type EventMapDefinition = Record<string, EventHandler | EventHandler[]>;

export interface LoaderEvents<T = unknown> {
	load: [LoadedModule<T>];
	unload: [LoadedModule<T>];
	reload: [LoadedModule<T>];
	error: [Error, string];

	watch: [string];
	unwatch: [string];

	change: [string];
}

export interface WatchOptions {
	/**
	 * Watch file/folder changes.
	 *
	 * @default false
	 */
	watch?: boolean;

	/**
	 * Debounce file changes.
	 *
	 * @default 100
	 */
	debounce?: number;
}
