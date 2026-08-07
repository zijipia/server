import { ZijiApp, type AppEvents, type PluginDescriptor } from "@ziji/core";
import process from "node:process";

export interface ServerOptions<EM extends AppEvents = AppEvents> {
	plugins?: PluginDescriptor<EM>[];
	extensions?: PluginDescriptor<EM>[];
	keepAlive?: boolean;
}

export class Server<EM extends AppEvents = AppEvents> {
	readonly app: ZijiApp<EM>;
	private readonly options?: ServerOptions<EM>;
	private keepAliveInterval: NodeJS.Timeout | null = null;
	private readonly signalListeners = new Map<string, () => void>();

	constructor(options?: ServerOptions<EM>) {
		this.options = options;
		this.app = new ZijiApp<EM>();
		for (const plugin of options?.plugins ?? []) {
			this.app.register(plugin);
		}
		for (const extension of options?.extensions ?? []) {
			this.app.register(extension);
		}
	}

	register(plugin: PluginDescriptor<EM>): void {
		this.app.register(plugin);
	}

	registerExtension(extension: PluginDescriptor<EM>): void {
		this.register(extension);
	}

	async boot(): Promise<void> {
		await this.app.boot();
		this.setupSignalHandlers();
		if (this.options?.keepAlive) {
			this.keepAliveInterval = setInterval(() => {}, 1000);
		}
	}

	async shutdown(): Promise<void> {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval);
			this.keepAliveInterval = null;
		}
		this.cleanupSignalHandlers();
		await this.app.shutdown();
	}

	private setupSignalHandlers(): void {
		const signals = ["SIGINT", "SIGTERM"];
		for (const signal of signals) {
			const listener = async () => {
				console.log(`\nReceived ${signal}, shutting down gracefully...`);
				try {
					await this.shutdown();
					process.exit(0);
				} catch (error) {
					console.error("Error during shutdown:", error);
					process.exit(1);
				}
			};
			process.on(signal, listener);
			this.signalListeners.set(signal, listener);
		}
	}

	private cleanupSignalHandlers(): void {
		for (const [signal, listener] of this.signalListeners.entries()) {
			process.off(signal, listener);
		}
		this.signalListeners.clear();
	}
}

