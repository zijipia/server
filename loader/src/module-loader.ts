import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { ExtensionDefinition } from "./types.js";

const require = createRequire(import.meta.url);

export class ModuleLoader {
	public async load(filePath: string, definition?: ExtensionDefinition<any>, reload = false): Promise<unknown> {
		if (definition?.load) {
			return definition.load(filePath, {
				path: filePath,
				extension: definition.extension,
			});
		}

		if (reload) this.invalidate(filePath);
		return this.defaultLoad(filePath, reload);
	}

	public invalidate(filePath: string): void {
		try {
			const resolved = require.resolve(filePath);
			delete require.cache[resolved];
		} catch {
			// ESM modules are not stored in require.cache.
		}
	}

	private async defaultLoad(filePath: string, reload: boolean): Promise<unknown> {
		const extension = path.extname(filePath).toLowerCase();

		if (extension === ".cjs" || extension === ".json") {
			return this.normalize(require(filePath));
		}

		if (extension === ".mjs") {
			return this.importEsm(filePath, reload);
		}

		try {
			return this.normalize(require(filePath));
		} catch (error) {
			if (!this.isEsmError(error)) throw error;
			return this.importEsm(filePath, reload);
		}
	}

	private async importEsm(filePath: string, reload: boolean): Promise<unknown> {
		const url = pathToFileURL(filePath);
		if (reload) url.searchParams.set("ziji_reload", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
		return this.normalize(await import(url.href));
	}

	private normalize(module: unknown): unknown {
		if (!module || typeof module !== "object" || !("default" in module)) return module;

		const namespace = module as Record<string, unknown>;
		const namedExports = Object.keys(namespace).filter((key) => key !== "default" && key !== "__esModule");
		return namedExports.length === 0 ? namespace.default : module;
	}

	private isEsmError(error: unknown): boolean {
		return (
			error instanceof Error &&
			((error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ESM" ||
				(error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ASYNC_MODULE")
		);
	}
}
