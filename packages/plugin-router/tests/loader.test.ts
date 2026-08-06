import fs from "fs";
import path from "path";
import { loadRoutes } from "../src/loader";
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
});
