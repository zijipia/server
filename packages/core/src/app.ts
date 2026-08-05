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

export interface AppOptions<EM extends EventMap & AppEvents = AppEvents> {
	eventBus?: EventBus<EM>;
	container?: Container;
	pluginManager?: PluginManager<EM>;
}

export class ZijiApp<EM extends EventMap & AppEvents = AppEvents> {
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

		try {
			await this.events.emit("app:boot", undefined);

			if (options?.loadConfig) {
				await options.loadConfig();
			}

			await this.events.emit("app:config", undefined);
			await this.plugins.bootstrap();

			this.state = "ready";
			await this.events.emit("app:ready", undefined);
		} catch (error) {
			this.state = "created";
			throw error;
		}
	}

	async shutdown(): Promise<void> {
		if (this.state !== "ready") {
			throw new Error(`Application cannot shutdown from state ${this.state}`);
		}

		this.state = "shuttingDown";

		let shutdownError: unknown;

		try {
			await this.events.emit("app:shutdown", undefined);
		} catch (error) {
			shutdownError = error;
		}

		try {
			await this.plugins.dispose();
		} catch (disposeError) {
			if (shutdownError) {
				throw new AggregateError([shutdownError, disposeError], "Shutdown failed during events and dispose");
			}
			throw disposeError;
		}

		this.state = "disposed";

		if (shutdownError) {
			throw shutdownError;
		}
	}
}
