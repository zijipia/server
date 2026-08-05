import type { Constructor, Token } from "./types";

export type RegistrationOptions<T> = { useClass: Constructor<T> } | { useValue: T } | { useFactory: (container: Container) => T };

export interface Registration<T> {
	readonly token: Token<T>;
	readonly options: RegistrationOptions<T>;
	readonly scope: "singleton" | "transient";
}

export class Container {
	private readonly registrations = new Map<symbol, Registration<unknown>>();
	private readonly values = new Map<symbol, unknown>();

	register<T>(token: Token<T>, options: RegistrationOptions<T>, scope: "singleton" | "transient" = "singleton"): void {
		if (this.registrations.has(token.symbol)) {
			throw new Error(`Container already has registration for token ${token.description}`);
		}

		this.registrations.set(token.symbol, { token, options, scope });
	}

	resolve<T>(token: Token<T>): T {
		const registration = this.registrations.get(token.symbol) as Registration<T> | undefined;

		if (!registration) {
			throw new Error(`No registration for token ${token.description}`);
		}

		if (registration.scope === "singleton") {
			if (this.values.has(token.symbol)) {
				return this.values.get(token.symbol) as T;
			}

			const resolved = this.instantiate(registration);
			this.values.set(token.symbol, resolved);
			return resolved;
		}

		return this.instantiate(registration);
	}

	private instantiate<T>(registration: Registration<T>): T {
		const { options } = registration;

		if ("useValue" in options) {
			return options.useValue as T;
		}

		if ("useFactory" in options) {
			return options.useFactory(this) as T;
		}

		const ctor = options.useClass;
		return new ctor();
	}
}
