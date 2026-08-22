import type { EventBinding, EventMapDefinition, EventTarget, LoadedModule } from "./types.js";

export class EventManager<T = unknown> {
	private readonly bindings = new WeakMap<LoadedModule<T>, EventBinding[]>();

	public bind(
		loaded: LoadedModule<T>,
		target: EventTarget | undefined,
		on?: EventMapDefinition,
		once?: EventMapDefinition,
	): void {
		if (!target) {
			return;
		}

		const bindings: EventBinding[] = [];

		this.bindMap(loaded, target, on, false, bindings);

		this.bindMap(loaded, target, once, true, bindings);

		if (bindings.length > 0) {
			this.bindings.set(loaded, bindings);
		}
	}

	public unbind(loaded: LoadedModule<T>): void {
		const bindings = this.bindings.get(loaded);

		if (!bindings) {
			return;
		}

		for (const binding of bindings) {
			binding.target.off(binding.event, binding.handler);
		}

		this.bindings.delete(loaded);
	}

	private bindMap(
		loaded: LoadedModule<T>,
		target: EventTarget,
		map: EventMapDefinition | undefined,
		once: boolean,
		bindings: EventBinding[],
	): void {
		if (!map) {
			return;
		}

		for (const [event, definition] of Object.entries(map)) {
			const handlers = Array.isArray(definition) ? definition : [definition];

			for (const definition of handlers) {
				const handler = this.resolveHandler(loaded.module, definition);

				if (!handler) {
					throw new Error(`Event handler "${String(definition)}" ` + `was not found in module "${loaded.name}".`);
				}

				const bound = handler.bind(loaded.module);

				if (once) {
					target.once(event, bound);
				} else {
					target.on(event, bound);
				}

				bindings.push({
					event,
					handler: bound,
					once,
					target,
				});
			}
		}
	}

	private resolveHandler(
		module: T,
		definition: string | ((...args: any[]) => unknown),
	): ((...args: any[]) => unknown) | undefined {
		if (typeof definition === "function") {
			return definition;
		}

		const value = (module as Record<string, unknown>)?.[definition];

		if (typeof value !== "function") {
			return undefined;
		}

		return value as (...args: any[]) => unknown;
	}
}
