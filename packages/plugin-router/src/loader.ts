import fs from "fs";
import path from "path";
import { Loader } from "@ziji/core";
import { LoadRoutesOptions, RouteMeta } from "./types";
import { compose } from "./middleware";

function isRouteExport(value: unknown): value is Function & { __route?: RouteMeta } {
	return typeof value === "function" && !!(value as { __route?: RouteMeta }).__route;
}

export async function loadRoutes<Req = any, Res = any>(opts: LoadRoutesOptions<Req, Res>) {
	const routesDir = path.resolve(opts.routesDir);
	if (!fs.existsSync(routesDir)) return;

	const dev = opts.dev ?? false;
	const extensions = opts.extensions ?? (dev ? [".js", ".mjs", ".cjs", ".ts"] : [".js", ".mjs", ".cjs"]);

	const loader = new Loader({ directory: routesDir, extensions });
	try {
		const loadedModules = await loader.load();
		for (const { module } of loadedModules) {
			const mod = module as Record<string, unknown>;
			for (const key of Object.keys(mod)) {
				const exp = mod[key];
				if (isRouteExport(exp)) {
					const meta = exp.__route as RouteMeta;
					const method = meta.method;
					let handler: any = exp;
					if (opts.middlewares && opts.middlewares.length) {
						const runner = compose<any, any>(opts.middlewares);
						handler = (req: any, res: any) => runner(req, res, exp as any);
					}
					opts.router[method](meta.path, handler);
				}
			}
		}
	} finally {
		await loader.dispose();
	}
}
