import { describe, expect, it } from "vitest";
import { Container, createToken } from "../src";

describe("Container", () => {
	const LOGGER = createToken<string>("logger");

	it("resolves singleton values", () => {
		const container = new Container();
		const value = { level: "info" };
		container.register(LOGGER, { useValue: value }, "singleton");

		expect(container.resolve(LOGGER)).toBe(value);
	});

	it("throws when registration is missing", () => {
		const container = new Container();
		expect(() => container.resolve(LOGGER)).toThrow(/No registration/);
	});
});
