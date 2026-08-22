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
			console.log(`[ModuleLoader] invalidate: filePath=${filePath}, resolved=${resolved}`);
			console.log(`[ModuleLoader] require.cache keys:`, Object.keys(require.cache));
			if (require.cache[resolved]) {
				console.log(`[ModuleLoader] Found in require.cache, deleting`);
				delete require.cache[resolved];
			} else {
				console.log(`[ModuleLoader] Not found in require.cache under resolved path`);
			}
		} catch (error) {
			console.log(`[ModuleLoader] invalidate failed:`, error);
			// ESM modules are not stored in require.cache.
		}
	}

	private async defaultLoad(filePath: string, reload: boolean): Promise<unknown> {
		const extension = path.extname(filePath).toLowerCase();
		console.log(`[ModuleLoader] defaultLoad filePath: ${filePath}, reload: ${reload}, extension: ${extension}`);

		if (extension === ".cjs" || extension === ".json") {
			console.log(`[ModuleLoader] cjs or json path, requiring`);
			return this.normalize(require(filePath));
		}

		if (extension === ".mjs") {
			console.log(`[ModuleLoader] mjs path, importing esm`);
			return this.importEsm(filePath, reload);
		}

		try {
			console.log(`[ModuleLoader] trying require`);
			const res = require(filePath);
			console.log(`[ModuleLoader] require succeeded:`, res);
			if (
				res &&
				(Object.prototype.toString.call(res) === "[object Module]" || (typeof res === "object" && "__esModule" in res))
			) {
				console.log(`[ModuleLoader] require returned ESM module, delegating to importEsm`);
				return this.importEsm(filePath, reload);
			}
			return this.normalize(res);
		} catch (error) {
			console.log(`[ModuleLoader] require failed, isEsmError: ${this.isEsmError(error)}, error:`, error);
			if (!this.isEsmError(error)) throw error;
			return this.importEsm(filePath, reload);
		}
	}

	private async importEsm(filePath: string, reload: boolean): Promise<unknown> {
		const url = pathToFileURL(filePath);
		if (reload) url.searchParams.set("ziji_reload", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
		console.log(`[ModuleLoader] importEsm url: ${url.href}`);
		const result = await import(url.href);
		console.log(`[ModuleLoader] importEsm result:`, result);
		const normalized = this.normalize(result);
		console.log(`[ModuleLoader] importEsm normalized:`, normalized);
		return normalized;
	}

	private normalize(module: unknown): unknown {
		console.log(`[ModuleLoader] normalize input:`, module);
		if (!module || typeof module !== "object" || !("default" in module)) return module;

		const namespace = module as Record<string, unknown>;
		const namedExports = Object.keys(namespace).filter((key) => key !== "default" && key !== "__esModule");
		const res = namedExports.length === 0 ? namespace.default : module;
		console.log(`[ModuleLoader] normalize output:`, res);
		return res;
	}

	private isEsmError(error: unknown): boolean {
		return (
			error instanceof Error &&
			((error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ESM" ||
				(error as NodeJS.ErrnoException).code === "ERR_REQUIRE_ASYNC_MODULE")
		);
	}
}
