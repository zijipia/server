import type { Container } from "./container";
import type { EventBus, EventMap } from "./event-bus";

export interface PluginContext<EM extends EventMap = Record<string, unknown>> {
	container: Container;
	events: EventBus<EM>;
}

export interface PluginDescriptor<EM extends EventMap = Record<string, unknown>> {
	readonly name: string;
	readonly dependencies?: string[];

	setup?: (context: PluginContext<EM>) => Promise<void>;
	ready?: (context: PluginContext<EM>) => Promise<void>;
	reload?: (context: PluginContext<EM>) => Promise<void>;
	dispose?: (context: PluginContext<EM>) => Promise<void>;
}

export function definePlugin<EM extends EventMap>(descriptor: PluginDescriptor<EM>): PluginDescriptor<EM> {
	return descriptor;
}
