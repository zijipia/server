export * from "./types";
export * from "./decorators";
export { loadRoutes } from "./loader";
import { loadRoutes } from "./loader";

export function pluginRouter(opts?: { routesDir?: string; middlewares?: any[] }) {
	return {
		name: "@ziji/plugin-router",
		async setup(app: any) {
			const routesDir = opts?.routesDir || "routes";
			const router = app.router;
			if (!router) throw new Error("App must provide a `router` with HTTP methods");
			await loadRoutes({ routesDir, router, middlewares: opts?.middlewares });
		},
	};
}

export default pluginRouter;
