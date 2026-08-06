import fs from "fs";
import path from "path";
import { Loader } from "@ziji/core";
import { LoadRoutesOptions, RouteMeta } from "./types";
import { compose } from "./middleware";

function isRouteExport(value: unknown): value is Function & { __route?: RouteMeta } {
	return typeof value === "function" && !!(value as { __route?: RouteMeta }).__route;
}

export async function loadRoutes(opts: LoadRoutesOptions) {
	const routesDir = path.resolve(opts.routesDir);
	if (!fs.existsSync(routesDir)) return;

	const loader = new Loader({ directory: routesDir, extensions: [".js", ".ts"] });
	try {
		const loadedModules = await loader.load();
		for (const { module } of loadedModules) {
			const mod = module as Record<string, unknown>;
			for (const key of Object.keys(mod)) {
				const exp = mod[key];
				if (isRouteExport(exp)) {
					const meta = exp.__route as RouteMeta;
					const method = meta.method;
					let handler: Function = exp;
					if (opts.middlewares && opts.middlewares.length) {
						const runner = compose(opts.middlewares);
						handler = (req: any, res: any) => runner(req, res, exp);
					}
					opts.router[method](meta.path, handler);
				}
			}
		}
	} finally {
		await loader.dispose();
	}
}
