import type { IncomingMessage, ServerResponse } from "http";

export interface RequestContext<Req = IncomingMessage, Res = ServerResponse> {
	req: Req;
	res: Res;
	user?: { id: string; [key: string]: unknown };
	// plugin-specific extensions (e.g., db) can be added via module augmentation
	[key: string]: unknown;
}

export type RouteWithCtx<Req = IncomingMessage, Res = ServerResponse, Ret = unknown> = (ctx: RequestContext<Req, Res>) => Ret;

export function adapt<Req = IncomingMessage, Res = ServerResponse, Ret = unknown>(handler: RouteWithCtx<Req, Res, Ret>) {
	return function (req: Req, res: Res) {
		const ctx: RequestContext<Req, Res> = { req, res };
		return handler(ctx);
	};
}

// Example module augmentation (consumer can put this in their project):
// declare module '@ziji/core' {
//   interface AppContext {
//     request: RequestContext
//   }
// }
