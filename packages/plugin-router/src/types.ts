export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "all";

export interface RouteMeta {
	method: HttpMethod;
	path: string;
}

export type RouteHandler = (...args: any[]) => any & { __route?: RouteMeta };

export type Middleware = (req: any, res: any, next: () => Promise<void> | void) => any;

export interface LoadRoutesOptions {
	routesDir: string;
	router: {
		[K in HttpMethod]: (path: string, handler: Function) => void;
	};
	middlewares?: Middleware[];
}
