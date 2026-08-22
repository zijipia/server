import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { ExtensionDefinition } from "./types.js";

const require = createRequire(import.meta.url);

export class ModuleLoader {
	public async load(filePath: string, definition?: ExtensionDefinition<any>): Promise<unknown> {
		if (definition?.load) {
			return definition.load(filePath, {
				path: filePath,
				extension: definition.extension,
			});
		}

		return this.defaultLoad(filePath);
	}

	public invalidate(filePath: string): void {
		try {
			const resolved = require.resolve(filePath);

			delete require.cache[resolved];
		} catch {
			// ESM doesn't use require.cache.
		}
	}

	private async defaultLoad(filePath: string): Promise<unknown> {
		const extension = path.extname(filePath).toLowerCase();

		if (extension === ".cjs" || extension === ".json") {
			return this.normalize(require(filePath));
		}

		if (extension === ".mjs") {
			return this.normalize(await import(pathToFileURL(filePath).href));
		}

		try {
			return this.normalize(require(filePath));
		} catch (error) {
			if (!this.isEsmError(error)) {
				throw error;
			}

			return this.normalize(await import(pathToFileURL(filePath).href));
		}
	}

	private normalize(module: unknown): unknown {
		if (module && typeof module === "object" && "default" in module) {
			const namespace = module as Record<string, unknown>;

			if (Object.keys(namespace).length === 1) {
				return namespace.default;
			}
		}

		return module;
	}

	private isEsmError(error: unknown): boolean {
		return (
			error instanceof Error &&
			((error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ESM" ||
				(error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ASYNC_MODULE")
		);
	}
}
