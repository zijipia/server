import { RouteMeta } from "./types";

export function createRouteDecorator(method: RouteMeta["method"]) {
	return (path: string) => {
		return (handler: Function) => {
			(handler as any).__route = { method, path } as RouteMeta;
			return handler as any;
		};
	};
}

export const Get = createRouteDecorator("get");
export const Post = createRouteDecorator("post");
export const Put = createRouteDecorator("put");
export const Delete = createRouteDecorator("delete");
