import { Get } from "../../src/decorators";
import { adapt } from "../../src/context";

export const getUsers = Object.assign(
	adapt(async (ctx) => {
		const { res } = ctx;
		res.end(JSON.stringify([{ id: "1", name: "Alice" }]));
	}),
	{ __route: { method: "get", path: "/users" } },
);

export const createUser = Object.assign(
	adapt(async (ctx) => {
		const { req, res } = ctx;
		// naive body read (example only)
		let body = "";
		for await (const chunk of req) body += chunk;
		res.end(JSON.stringify({ ok: true, body }));
	}),
	{ __route: { method: "post", path: "/users" } },
);
