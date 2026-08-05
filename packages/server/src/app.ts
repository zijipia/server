import { ZijiApp, type AppEvents, type PluginDescriptor } from "@ziji/core";

export interface ServerOptions<EM extends AppEvents = AppEvents> {
	plugins?: PluginDescriptor<EM>[];
	extensions?: PluginDescriptor<EM>[];
}

export class Server<EM extends AppEvents = AppEvents> {
	readonly app: ZijiApp<EM>;

	constructor(options?: ServerOptions<EM>) {
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
	}

	async shutdown(): Promise<void> {
		await this.app.shutdown();
	}
}
