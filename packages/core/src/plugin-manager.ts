import type { PluginDescriptor } from "./plugin";
import type { EventBus, EventMap } from "./event-bus";
import type { Container } from "./container";

interface InternalPlugin<EM extends EventMap> {
	descriptor: PluginDescriptor<EM>;
	state: "pending" | "setup" | "ready" | "disposed";
}

export class PluginManager<EM extends EventMap = Record<string, unknown>> {
	private readonly plugins = new Map<string, InternalPlugin<EM>>();
	private readonly container: Container;
	private readonly events: EventBus<EM>;

	constructor(container: Container, events: EventBus<EM>) {
		this.container = container;
		this.events = events;
	}

	register(plugin: PluginDescriptor<EM>): void {
		if (this.plugins.has(plugin.name)) {
			throw new Error(`Plugin ${plugin.name} is already registered`);
		}

		this.plugins.set(plugin.name, { descriptor: plugin, state: "pending" });
	}

	async bootstrap(): Promise<void> {
		const order = this.resolveOrder();

		for (const name of order) {
			const plugin = this.getPlugin(name);
			if (plugin.descriptor.setup) {
				await plugin.descriptor.setup({ container: this.container, events: this.events });
			}
			plugin.state = "setup";
		}

		for (const name of order) {
			const plugin = this.getPlugin(name);
			if (plugin.descriptor.ready) {
				await plugin.descriptor.ready({ container: this.container, events: this.events });
			}
			plugin.state = "ready";
		}
	}

	async dispose(): Promise<void> {
		const order = this.resolveOrder().reverse();
		for (const name of order) {
			const plugin = this.getPlugin(name);
			if (plugin.state === "disposed") {
				continue;
			}
			if (plugin.descriptor.dispose) {
				await plugin.descriptor.dispose({ container: this.container, events: this.events });
			}
			plugin.state = "disposed";
		}
	}

	getContainer(): Container {
		return this.container;
	}

	getEventBus(): EventBus<EM> {
		return this.events;
	}

	private getPlugin(name: string): InternalPlugin<EM> {
		const plugin = this.plugins.get(name);
		if (!plugin) {
			throw new Error(`Plugin ${name} is not registered`);
		}
		return plugin;
	}

	private resolveOrder(): string[] {
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const order: string[] = [];

		for (const name of this.plugins.keys()) {
			this.visit(name, visited, visiting, order);
		}

		return order;
	}

	private visit(name: string, visited: Set<string>, visiting: Set<string>, order: string[]): void {
		if (visited.has(name)) {
			return;
		}

		if (visiting.has(name)) {
			throw new Error(`Circular plugin dependency detected: ${[...visiting, name].join(" -> ")}`);
		}

		visiting.add(name);
		const plugin = this.getPlugin(name);

		for (const dependency of plugin.descriptor.dependencies ?? []) {
			if (!this.plugins.has(dependency)) {
				throw new Error(`Plugin ${plugin.descriptor.name} depends on missing plugin ${dependency}`);
			}
			this.visit(dependency, visited, visiting, order);
		}

		visiting.delete(name);
		visited.add(name);
		order.push(name);
	}
}
