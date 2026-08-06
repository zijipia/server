import { RouteMeta } from "./types";

export function createRouteDecorator(method: RouteMeta["method"]) {
	return (path: string) => {
		return <T extends Function>(handler: T): T => {
			(handler as any).__route = { method, path } as RouteMeta;
			return handler;
		};
	};
}

export const Get = createRouteDecorator("get");
export const Post = createRouteDecorator("post");
export const Put = createRouteDecorator("put");
export const Delete = createRouteDecorator("delete");
