import { Middleware } from "./types";

export function compose(middlewares: Middleware[]) {
	return async function (req: any, res: any, handler: Function) {
		let idx = -1;
		async function dispatch(i: number): Promise<void> {
			if (i <= idx) return;
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
