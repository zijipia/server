import type { AppEvents } from "./app";
import type { ZijiApp } from "./app";
import type { EventMap } from "./event-bus";

let appInstance: unknown = null;

export function setApp<EM extends EventMap & AppEvents = AppEvents>(app: ZijiApp<EM>): void {
	if (appInstance && appInstance !== app) {
		throw new Error("Application singleton is already set. Shut down the current app before creating a new one.");
	}

	appInstance = app;
}

export function getApp<EM extends EventMap & AppEvents = AppEvents>(): ZijiApp<EM> {
	if (!appInstance) {
		throw new Error("Application is not initialized. Create ZijiApp before calling getApp().");
	}

	return appInstance as ZijiApp<EM>;
}

export function resetApp(): void {
	appInstance = null;
}
