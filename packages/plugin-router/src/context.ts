export interface RequestContext {
	req: any;
	res: any;
	user?: { id: string; [key: string]: any };
	// plugin-specific extensions (e.g., db) can be added via module augmentation
	[key: string]: any;
}

export type RouteWithCtx = (ctx: RequestContext) => any;

export function adapt(handler: RouteWithCtx) {
	return function (req: any, res: any) {
		const ctx: RequestContext = { req, res };
		return handler(ctx);
	};
}

// Example module augmentation (consumer can put this in their project):
// declare module '@ziji/core' {
//   interface AppContext {
//     request: RequestContext
//   }
// }
