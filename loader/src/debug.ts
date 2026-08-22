import util from "node:util";

export type LoaderDebugLogger = (message: string, ...args: unknown[]) => void;
export type LoaderDebug = boolean | LoaderDebugLogger;

export function createDebug(debug: LoaderDebug | undefined, scope: string): LoaderDebugLogger {
	const enabled = debug === true || (debug === undefined && process.env.ZIJI_LOADER_DEBUG === "1");
	const logger = typeof debug === "function" ? debug : undefined;

	return (message, ...args) => {
		if (logger) {
			logger(`[${scope}] ${message}`, ...args);
			return;
		}
		if (!enabled) return;

		const suffix = args.length > 0 ? ` ${args.map((value) => format(value)).join(" ")}` : "";
		console.debug(`[${scope}] ${message}${suffix}`);
	};
}

function format(value: unknown): string {
	if (typeof value === "string") return value;
	return util.inspect(value, { depth: 4, colors: false, breakLength: Infinity });
}
