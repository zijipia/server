import { describe, expect, it } from "vitest";
import { EventPriority, SimpleEventBus } from "../src/event-bus";

describe("SimpleEventBus", () => {
	it("supports typed event payloads", async () => {
		type Events = {
			"user:create": { id: string; email: string };
			"server:ready": void;
		};

		const bus = new SimpleEventBus<Events>();
		let received: string | undefined;

		bus.on("user:create", (payload) => {
			received = `${payload.id}:${payload.email}`;
		});

		await bus.emit("user:create", { id: "1", email: "test@example.com" });

		expect(received).toBe("1:test@example.com");
	});

	it("removes once listeners after first emit", async () => {
		type Events = { ping: void };
		const bus = new SimpleEventBus<Events>();
		let calls = 0;

		bus.once("ping", () => {
			calls += 1;
		});

		await bus.emit("ping", undefined);
		await bus.emit("ping", undefined);

		expect(calls).toBe(1);
	});

	it("invokes high priority listeners before low priority listeners", async () => {
		type Events = { task: void };
		const bus = new SimpleEventBus<Events>();
		const order: string[] = [];

		bus.on(
			"task",
			() => {
				order.push("normal");
			},
			EventPriority.NORMAL,
		);
		bus.on(
			"task",
			() => {
				order.push("low");
			},
			EventPriority.LOW,
		);
		bus.on(
			"task",
			() => {
				order.push("high");
			},
			EventPriority.HIGH,
		);

		await bus.emit("task", undefined);

		expect(order).toEqual(["high", "normal", "low"]);
	});

	it("supports wildcard listeners", async () => {
		type Events = {
			"user:create": { id: string };
			"user:update": { id: string };
		};
		const bus = new SimpleEventBus<Events>();
		const events: string[] = [];

		bus.onWildcard("user:*", ({ id }) => {
			events.push(id);
		});

		await bus.emit("user:create", { id: "1" });
		await bus.emit("user:update", { id: "2" });

		expect(events).toEqual(["1", "2"]);
	});

	it("removes once listeners even if they throw an error", async () => {
		type Events = { ping: void };
		const bus = new SimpleEventBus<Events>();
		let calls = 0;

		bus.once("ping", () => {
			calls += 1;
			throw new Error("test error");
		});

		await expect(bus.emit("ping", undefined)).rejects.toThrow("test error");
		await expect(bus.emit("ping", undefined)).resolves.not.toThrow();

		expect(calls).toBe(1);
	});

	it("supports emitting without payload when payload is optional", async () => {
		type Events = {
			ping: void;
			optional?: string;
		};
		const bus = new SimpleEventBus<Events>();
		let pingCalls = 0;
		let optionalCalls = 0;

		bus.on("ping", () => {
			pingCalls += 1;
		});

		bus.on("optional", (val) => {
			optionalCalls += 1;
			expect(val).toBeUndefined();
		});

		await bus.emit("ping");
		await bus.emit("optional");

		expect(pingCalls).toBe(1);
		expect(optionalCalls).toBe(1);
	});
});
