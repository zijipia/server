import { Container } from "./container";
import { EventBus, EventKey, EventMap, EventPayload, SimpleEventBus } from "./event-bus";
import { PluginManager } from "./plugin-manager";
import type { PluginDescriptor } from "./plugin";
import { resetApp, setApp } from "./app-singleton";
import { runStartup, type RunStartupResult } from "./startup";
import type { Loader } from "./loader";

export interface AppEvents {
	"app:boot": void;
	"app:config": void;
	"app:ready": void;
	"app:shutdown": void;
}

export interface BootOptions {
	loadConfig?: () => Promise<void>;
	startupDirectory?: string;
	dev?: boolean;
}

export interface AppOptions<EM extends EventMap & AppEvents = AppEvents> {
	eventBus?: EventBus<EM>;
	container?: Container;
	pluginManager?: PluginManager<EM>;
	registerSingleton?: boolean;
}

export class ZijiApp<EM extends EventMap & AppEvents = AppEvents> {
	readonly container: Container;
	readonly events: EventBus<EM>;
	readonly plugins: PluginManager<EM>;

	private state: "created" | "booting" | "ready" | "shuttingDown" | "disposed" = "created";
	private startupResult: RunStartupResult | null = null;

	private async emitLifecycle(event: keyof AppEvents): Promise<void> {
		return this.events.emit(event as unknown as EventKey<EM>, undefined as any);
	}

	constructor(options?: AppOptions<EM>) {
		this.container = options?.container ?? new Container();
		this.events = options?.eventBus ?? new SimpleEventBus<EM>();
		this.plugins = options?.pluginManager ?? new PluginManager<EM>(this.container, this.events);

		if (options?.registerSingleton !== false) {
			setApp(this);
		}
	}

	register(plugin: PluginDescriptor<EM>): void {
		this.plugins.register(plugin);
	}

	getStartupLoader(): Loader | null {
		return this.startupResult?.loader ?? null;
	}

	getLoadedModule(filePath: string): unknown | undefined {
		return this.startupResult?.loader.getModule(filePath);
	}

	async boot(options?: BootOptions): Promise<void> {
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

			if (options?.startupDirectory) {
				this.startupResult = await runStartup({
					directory: options.startupDirectory,
					dev: options.dev,
				});
			}

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
			if (this.startupResult) {
				await this.startupResult.loader.dispose();
				this.startupResult = null;
			}

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
		resetApp();

		if (shutdownError) {
			throw shutdownError;
		}
	}
}
