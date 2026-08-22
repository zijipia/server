import fs from "node:fs";
import path from "node:path";

export interface WatcherOptions {
	recursive: boolean;
	debounce: number;
	ignore?: (path: string, isDirectory: boolean) => boolean;
}

export type WatchEvent = "change" | "rename";

export class LoaderWatcher {
	private readonly watchers = new Map<string, fs.FSWatcher>();
	private readonly timers = new Map<string, NodeJS.Timeout>();
	private readonly options: WatcherOptions;

	public constructor(options: WatcherOptions) {
		this.options = options;
	}

	public watch(target: string, callback: (filePath: string, event: WatchEvent) => void): void {
		const absolute = path.resolve(target);
		if (this.watchers.has(absolute)) return;

		const isDirectory = fs.statSync(absolute).isDirectory();
		const basePath = isDirectory ? absolute : path.dirname(absolute);
		const watchedFile = isDirectory ? undefined : absolute;

		const watcher = fs.watch(
			absolute,
			{ recursive: isDirectory && this.options.recursive },
			(event, filename) => {
				if (!filename) return;

				const filePath = path.resolve(basePath, filename.toString());
				if (watchedFile && filePath !== watchedFile) return;

				if (this.options.ignore?.(filePath, false)) return;
				this.schedule(filePath, event, callback);
			},
		);

		watcher.on("error", () => this.unwatch(absolute));
		this.watchers.set(absolute, watcher);
	}

	public unwatch(target: string): boolean {
		const absolute = path.resolve(target);
		const watcher = this.watchers.get(absolute);
		if (!watcher) return false;

		watcher.close();
		this.watchers.delete(absolute);
		this.clearTimers(absolute);
		return true;
	}

	public close(): void {
		for (const watcher of this.watchers.values()) watcher.close();
		this.watchers.clear();
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
	}

	private schedule(filePath: string, event: WatchEvent, callback: (filePath: string, event: WatchEvent) => void): void {
		const oldTimer = this.timers.get(filePath);
		if (oldTimer) clearTimeout(oldTimer);

		const timer = setTimeout(() => {
			this.timers.delete(filePath);
			callback(filePath, event);
		}, this.options.debounce);

		this.timers.set(filePath, timer);
	}

	private clearTimers(root: string): void {
		for (const [filePath, timer] of this.timers) {
			if (filePath === root || filePath.startsWith(root + path.sep)) {
				clearTimeout(timer);
				this.timers.delete(filePath);
			}
		}
	}
}
