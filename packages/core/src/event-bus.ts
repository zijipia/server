export type EventMap = object;

export enum EventPriority {
	HIGH = 1,
	NORMAL = 0,
	LOW = -1,
}

export type EventPayload<EM extends EventMap, Event extends string> = Event extends keyof EM ? EM[Event] : unknown;

export type EventListener<EM extends EventMap, Event extends string> = (payload: EventPayload<EM, Event>) => void | Promise<void>;

export type EventKey<EM extends EventMap> = Extract<keyof EM, string>;

export interface EventBus<EM extends EventMap = Record<string, unknown>> {
	on<Event extends EventKey<EM>>(event: Event, listener: EventListener<EM, Event>, priority?: EventPriority): void;

	once<Event extends EventKey<EM>>(event: Event, listener: EventListener<EM, Event>, priority?: EventPriority): void;

	off<Event extends EventKey<EM>>(event: Event, listener: EventListener<EM, Event>): void;

	emit<Event extends EventKey<EM>>(event: Event, payload?: EventPayload<EM, Event>): Promise<void>;

	onWildcard(pattern: string, listener: EventListener<EM, string>, priority?: EventPriority): void;
}

interface ListenerEntry<EM extends EventMap> {
	event: string;
	listener: EventListener<EM, string>;
	once: boolean;
	priority: EventPriority;
	wildcard: boolean;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardToRegExp(pattern: string): RegExp {
	const escaped = escapeRegExp(pattern).replace(/\\\*/g, ".*");
	return new RegExp(`^${escaped}$`);
}

export class SimpleEventBus<EM extends EventMap = Record<string, unknown>> implements EventBus<EM> {
	private listeners = new Set<ListenerEntry<EM>>();

	on<Event extends EventKey<EM>>(
		event: Event,
		listener: EventListener<EM, Event>,
		priority: EventPriority = EventPriority.NORMAL,
	): void {
		this.listeners.add({
			event,
			listener: listener as EventListener<EM, string>,
			once: false,
			priority,
			wildcard: event.includes("*"),
		});
	}

	once<Event extends EventKey<EM>>(
		event: Event,
		listener: EventListener<EM, Event>,
		priority: EventPriority = EventPriority.NORMAL,
	): void {
		this.listeners.add({
			event,
			listener: listener as EventListener<EM, string>,
			once: true,
			priority,
			wildcard: event.includes("*"),
		});
	}

	off<Event extends EventKey<EM>>(event: Event, listener: EventListener<EM, Event>): void {
		for (const entry of [...this.listeners]) {
			if (entry.event === event && entry.listener === listener) {
				this.listeners.delete(entry);
			}
		}
	}

	onWildcard<Event extends string>(
		pattern: Event,
		listener: EventListener<EM, Event>,
		priority: EventPriority = EventPriority.NORMAL,
	): void {
		if (!pattern.includes("*")) {
			throw new Error("Wildcard listener must include `*`");
		}

		this.listeners.add({
			event: pattern,
			listener: listener as EventListener<EM, string>,
			once: false,
			priority,
			wildcard: true,
		});
	}

	async emit<Event extends EventKey<EM>>(event: Event, payload: EventPayload<EM, Event>): Promise<void> {
		const entries = [...this.listeners].filter((entry) => {
			if (entry.wildcard) {
				return wildcardToRegExp(entry.event).test(event);
			}
			return entry.event === event;
		});

		entries.sort((left, right) => right.priority - left.priority);

		for (const entry of [...entries]) {
			await entry.listener(payload as EventPayload<EM, Event>);
			if (entry.once) {
				this.off(entry.event as Event, entry.listener as EventListener<EM, Event>);
			}
		}
	}
}
