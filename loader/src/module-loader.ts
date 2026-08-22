import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createDebug, type LoaderDebug } from "./debug.js";
import type { ExtensionDefinition } from "./types.js";

const require = createRequire(import.meta.url);

export class ModuleLoader {
	private readonly debug: ReturnType<typeof createDebug>;

	public constructor(debug?: LoaderDebug) {
		this.debug = createDebug(debug, "ModuleLoader");
	}

	public async load(filePath: string, definition?: ExtensionDefinition<any>, reload = false): Promise<unknown> {
		this.debug("load", { filePath, extension: definition?.extension, customLoader: Boolean(definition?.load), reload });
		if (definition?.load) {
			const result = await definition.load(filePath, {
				path: filePath,
				extension: definition.extension,
			});
			this.debug("custom loader completed", { filePath });
			return result;
		}

		if (reload) this.invalidate(filePath);
		return this.defaultLoad(filePath, reload);
	}

	public invalidate(filePath: string): void {
		try {
			const resolved = require.resolve(filePath);
			const cached = Boolean(require.cache[resolved]);
			this.debug("invalidate", { filePath, resolved, cached });
			if (cached) delete require.cache[resolved];
		} catch (error) {
			// ESM modules are not stored in require.cache.
			this.debug("invalidate skipped", { filePath, error });
		}
	}

	private async defaultLoad(filePath: string, reload: boolean): Promise<unknown> {
		const extension = path.extname(filePath).toLowerCase();
		this.debug("defaultLoad", { filePath, reload, extension });

		if (extension === ".cjs" || extension === ".json") {
			this.debug("loading with require", { filePath });
			return this.normalize(require(filePath));
		}

		if (extension === ".mjs") {
			this.debug("loading with import", { filePath });
			return this.importEsm(filePath, reload);
		}

		try {
			const result = require(filePath);
			this.debug("require succeeded", { filePath });
			if (
				result &&
				(Object.prototype.toString.call(result) === "[object Module]" ||
					(typeof result === "object" && "__esModule" in result))
			) {
				this.debug("require returned ESM namespace, using import", { filePath });
				return this.importEsm(filePath, reload);
			}
			return this.normalize(result);
		} catch (error) {
			this.debug("require failed", { filePath, isEsmError: this.isEsmError(error), error });
			if (!this.isEsmError(error)) throw error;
			return this.importEsm(filePath, reload);
		}
	}

	private async importEsm(filePath: string, reload: boolean): Promise<unknown> {
		const url = pathToFileURL(filePath);
		if (reload) url.searchParams.set("ziji_reload", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
		this.debug("importEsm", { filePath, url: url.href, reload });
		const result = await import(url.href);
		return this.normalize(result);
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
