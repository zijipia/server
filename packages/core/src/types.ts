export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export interface Token<T> {
	readonly symbol: symbol;
	readonly description: string;
}

export function createToken<T>(description: string): Token<T> {
	return {
		symbol: Symbol(description),
		description,
	};
}
