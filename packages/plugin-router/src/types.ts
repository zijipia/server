export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "all";

export interface RouteMeta {
	method: HttpMethod;
	path: string;
}

export type RouteHandler<Req = unknown, Res = unknown, Ret = unknown> = ((req: Req, res: Res, ...args: unknown[]) => Ret) & { __route?: RouteMeta };

export type Middleware<Req = unknown, Res = unknown> = (req: Req, res: Res, next: () => Promise<void> | void) => unknown;

export interface LoadRoutesOptions<Req = unknown, Res = unknown> {
	routesDir: string;
	router: {
		[K in HttpMethod]: (path: string, handler: (req: Req, res: Res) => unknown) => void;
	};
	middlewares?: Middleware<Req, Res>[];
	dev?: boolean;
	extensions?: string[];
}
