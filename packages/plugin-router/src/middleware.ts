import { Middleware } from "./types";

export function compose<Req = unknown, Res = unknown>(middlewares: Middleware<Req, Res>[]) {
	return async function (req: Req, res: Res, handler: (req: Req, res: Res) => unknown) {
		let idx = -1;
		async function dispatch(i: number): Promise<void> {
			if (i <= idx) {
				throw new Error("next() called multiple times");
			}
			idx = i;
			if (i === middlewares.length) {
				await Promise.resolve(handler(req, res));
				return;
			}
			const mw = middlewares[i];
			await Promise.resolve(mw(req, res, () => dispatch(i + 1)));
		}
		await dispatch(0);
	};
}
