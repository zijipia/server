import fs from "fs";
import path from "path";
import { loadRoutes } from "../src/loader";
import { pluginRouter } from "../src";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("plugin-router loader", () => {
	const tmpDir = path.join(process.cwd(), "packages/plugin-router/tests/tmpRoutes");

	beforeEach(() => {
		if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
		fs.mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("loads js route files and registers handlers", async () => {
		const file = path.join(tmpDir, "users.js");
		const content = `
    exports.getUsers = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/users' } });
    exports.createUser = Object.assign(function (req, res) { res.end('created') }, { __route: { method: 'post', path: '/users' } });
    `;
		fs.writeFileSync(file, content);

		const registered: Array<{ method: string; path: string; fn: Function }> = [];
		const fakeRouter = {
			get(p: string, fn: Function) {
				registered.push({ method: "get", path: p, fn });
			},
			post(p: string, fn: Function) {
				registered.push({ method: "post", path: p, fn });
			},
			put() {},
			delete() {},
			patch() {},
			all() {},
		};

		await loadRoutes({ routesDir: tmpDir, router: fakeRouter as any });

		expect(registered).toHaveLength(2);
		expect(registered.find((r) => r.method === "get" && r.path === "/users")).toBeDefined();
		expect(registered.find((r) => r.method === "post" && r.path === "/users")).toBeDefined();
	});

	it("loads only emitted javascript routes by default", async () => {
		const jsFile = path.join(tmpDir, "users.js");
		const tsFile = path.join(tmpDir, "admin.ts");
		fs.writeFileSync(
			jsFile,
			"exports.getUsers = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/users' } });",
		);
		fs.writeFileSync(
			tsFile,
			"exports.getAdmin = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/admin' } });",
		);

		const registered: Array<{ method: string; path: string }> = [];
		const fakeRouter = {
			get(p: string) {
				registered.push({ method: "get", path: p });
			},
			post() {},
			put() {},
			delete() {},
			patch() {},
			all() {},
		};

		await loadRoutes({ routesDir: tmpDir, router: fakeRouter as any });

		expect(registered).toEqual([{ method: "get", path: "/users" }]);
	});

	it("loads ts route files when dev is true", async () => {
		const jsFile = path.join(tmpDir, "users.js");
		const tsFile = path.join(tmpDir, "admin.ts");
		fs.writeFileSync(
			jsFile,
			"exports.getUsers = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/users' } });",
		);
		fs.writeFileSync(
			tsFile,
			"exports.getAdmin = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/admin' } });",
		);

		const registered: Array<{ method: string; path: string }> = [];
		const fakeRouter = {
			get(p: string) {
				registered.push({ method: "get", path: p });
			},
			post() {},
			put() {},
			delete() {},
			patch() {},
			all() {},
		};

		await loadRoutes({ routesDir: tmpDir, router: fakeRouter as any, dev: true });

		expect(registered).toHaveLength(2);
		expect(registered.find((r) => r.path === "/users")).toBeDefined();
		expect(registered.find((r) => r.path === "/admin")).toBeDefined();
	});

	it("surfaces detailed config errors from pluginRouter", async () => {
		const plugin = pluginRouter({ routesDir: "" });
		await expect(plugin.setup({} as any)).rejects.toThrow("[@ziji/plugin-router] invalid config: `routesDir` cannot be an empty string");
	});

	it("surfaces detailed config errors when router is missing", async () => {
		const plugin = pluginRouter({ routesDir: "routes" });
		await expect(plugin.setup({} as any)).rejects.toThrow("[@ziji/plugin-router] invalid config: `app.router` is missing");
	});

	it("throws an error when next() is called multiple times", async () => {
		const registered: Array<{ method: string; path: string; fn: Function }> = [];
		const fakeRouter = {
			get(p: string, fn: Function) {
				registered.push({ method: "get", path: p, fn });
			},
			post() {},
			put() {},
			delete() {},
			patch() {},
			all() {},
		};

		const doubleNextMiddleware = async (req: any, res: any, next: any) => {
			await next();
			await next();
		};

		const file = path.join(tmpDir, "test-mw.js");
		const content = `
    exports.getTest = Object.assign(function (req, res) { res.end('ok') }, { __route: { method: 'get', path: '/test' } });
    `;
		fs.writeFileSync(file, content);

		await loadRoutes({
			routesDir: tmpDir,
			router: fakeRouter as any,
			middlewares: [doubleNextMiddleware]
		});

		expect(registered).toHaveLength(1);
		const handler = registered[0].fn;
		const req = {};
		const res = { end: () => {} };
		await expect(handler(req, res)).rejects.toThrow("next() called multiple times");
	});
});
