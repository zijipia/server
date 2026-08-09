import { afterEach, describe, expect, it } from "vitest";
import { ZijiApp } from "../src/app";
import { getApp, resetApp, setApp } from "../src/app-singleton";

describe("app singleton", () => {
	afterEach(() => {
		resetApp();
	});

	it("throws when getApp is called before initialization", () => {
		expect(() => getApp()).toThrow("Application is not initialized");
	});

	it("registers ZijiApp automatically in constructor", () => {
		const app = new ZijiApp();
		expect(getApp()).toBe(app);
	});

	it("allows opting out of automatic singleton registration", () => {
		const app = new ZijiApp({ registerSingleton: false });
		expect(() => getApp()).toThrow("Application is not initialized");
		setApp(app);
		expect(getApp()).toBe(app);
	});

	it("throws when registering a second app without shutdown", () => {
		new ZijiApp();
		expect(() => new ZijiApp()).toThrow("Application singleton is already set");
	});

	it("clears singleton after shutdown", async () => {
		const app = new ZijiApp();
		await app.boot();
		await app.shutdown();
		expect(() => getApp()).toThrow("Application is not initialized");
	});
});
