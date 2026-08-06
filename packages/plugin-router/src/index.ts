import { loadRoutes } from "./loader";
import { Middleware } from "./types";

export * from "./types";
export * from "./decorators";
export { loadRoutes } from "./loader";

export interface PluginRouterOptions<Req = unknown, Res = unknown> {
	routesDir?: string;
	middlewares?: Middleware<Req, Res>[];
	dev?: boolean;
	extensions?: string[];
}

export function pluginRouter<Req = unknown, Res = unknown>(opts?: PluginRouterOptions<Req, Res>) {
	return {
		name: "@ziji/plugin-router",
		async setup(app: any) { // TODO: type this
			if (opts && typeof opts.routesDir === "string" && opts.routesDir.trim() === "") {
				throw new Error("[@ziji/plugin-router] invalid config: `routesDir` cannot be an empty string");
			}
			const routesDir = opts?.routesDir || "routes";
			const router = app.router;
			if (!router) {
				throw new Error("[@ziji/plugin-router] invalid config: `app.router` is missing. The app must provide a `router` with HTTP methods to register routes.");
			}
			await loadRoutes({
				routesDir,
				router,
				middlewares: opts?.middlewares,
				dev: opts?.dev,
				extensions: opts?.extensions,
			});
		},
	};
}

export default pluginRouter;

