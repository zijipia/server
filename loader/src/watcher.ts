import fs from "node:fs";
import path from "node:path";

export interface WatcherOptions {
	recursive: boolean;
	debounce: number;

	ignore?: (path: string, isDirectory: boolean) => boolean;
}

export type WatchEvent = "change" | "rename";

export class LoaderWatcher {
	private watchers = new Map<string, fs.FSWatcher>();

	private timers = new Map<string, NodeJS.Timeout>();

	private readonly options: WatcherOptions;

	public constructor(options: WatcherOptions) {
		this.options = options;
	}

	public watch(target: string, callback: (filePath: string, event: WatchEvent) => void): void {
		const absolute = path.resolve(target);

		if (this.watchers.has(absolute)) {
			return;
		}

		const watcher = fs.watch(
			absolute,
			{
				recursive: this.options.recursive,
			},
			(event, filename) => {
				if (!filename) {
					return;
				}

				const filePath = path.resolve(absolute, filename.toString());

				this.schedule(filePath, event, callback);
			},
		);

		watcher.on("error", () => {
			this.unwatch(absolute);
		});

		this.watchers.set(absolute, watcher);
	}

	public unwatch(target: string): void {
		const absolute = path.resolve(target);

		const watcher = this.watchers.get(absolute);

		if (!watcher) {
			return;
		}

		watcher.close();

		this.watchers.delete(absolute);

		this.clearTimers(absolute);
	}

	public close(): void {
		for (const watcher of this.watchers.values()) {
			watcher.close();
		}

		this.watchers.clear();

		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}

		this.timers.clear();
	}

	private schedule(filePath: string, event: WatchEvent, callback: (filePath: string, event: WatchEvent) => void): void {
		const oldTimer = this.timers.get(filePath);

		if (oldTimer) {
			clearTimeout(oldTimer);
		}

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
