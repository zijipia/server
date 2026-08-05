import { Container } from "./container";
import { EventBus, EventKey, EventMap, SimpleEventBus } from "./event-bus";
import { PluginManager } from "./plugin-manager";
import type { PluginDescriptor } from "./plugin";

export interface AppEvents {
	"app:boot": void;
	"app:config": void;
	"app:ready": void;
	"app:shutdown": void;
}

export interface AppOptions<EM extends EventMap = AppEvents> {
	eventBus?: EventBus<EM>;
	container?: Container;
	pluginManager?: PluginManager<EM>;
}

export class ZijiApp<EM extends EventMap = AppEvents> {
	readonly container: Container;
	readonly events: EventBus<EM>;
	readonly plugins: PluginManager<EM>;

	private state: "created" | "booting" | "ready" | "shuttingDown" | "disposed" = "created";

	constructor(options?: AppOptions<EM>) {
		this.container = options?.container ?? new Container();
		this.events = options?.eventBus ?? new SimpleEventBus<EM>();
		this.plugins = options?.pluginManager ?? new PluginManager<EM>(this.container, this.events);
	}

	register(plugin: PluginDescriptor<EM>): void {
		this.plugins.register(plugin);
	}

	async boot(options?: { loadConfig?: () => Promise<void> }): Promise<void> {
		if (this.state !== "created") {
			throw new Error(`Application cannot boot from state ${this.state}`);
		}

		this.state = "booting";
		await this.events.emit("app:boot" as EventKey<EM>, undefined as any);

		if (options?.loadConfig) {
			await options.loadConfig();
		}

		await this.events.emit("app:config" as EventKey<EM>, undefined as any);
		await this.plugins.bootstrap();

		this.state = "ready";
		await this.events.emit("app:ready" as EventKey<EM>, undefined as any);
	}

	async shutdown(): Promise<void> {
		if (this.state !== "ready") {
			throw new Error(`Application cannot shutdown from state ${this.state}`);
		}

		this.state = "shuttingDown";
		await this.events.emit("app:shutdown" as EventKey<EM>, undefined as any);
		await this.plugins.dispose();
		this.state = "disposed";
	}
}
