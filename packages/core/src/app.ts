import { Container } from "./container";
import { EventBus, EventKey, EventMap, EventPayload, SimpleEventBus } from "./event-bus";
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

	private async emitLifecycle(event: keyof AppEvents): Promise<void> {
		return this.events.emit(event as unknown as EventKey<EM>, undefined as any);
	}

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
			await this.emitLifecycle("app:boot");

			if (options?.loadConfig) {
				await options.loadConfig();
			}

			await this.emitLifecycle("app:config");
			await this.plugins.bootstrap();

			this.state = "ready";
			await this.emitLifecycle("app:ready");
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
			await this.emitLifecycle("app:shutdown");
		} catch (error) {
			shutdownError = error;
		}

		try {
			await this.plugins.dispose();
		} catch (disposeError) {
			if (shutdownError) {
				throw new Error(
					`Shutdown failed during events and dispose: ${disposeError instanceof Error ? disposeError.message : String(disposeError)}`,
				);
			}
			throw disposeError;
		}

		this.state = "disposed";

		if (shutdownError) {
			throw shutdownError;
		}
	}
}
