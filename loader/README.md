# @ziji/loader

A convention-over-configuration Node.js & TypeScript module loader with a complete lifecycle (load, check, init, reload, unload,
destroy), built-in hot-reloading file/directory watcher, automatic event binding, and resource cleanup via `AbortSignal`.

## Features

- **Full Lifecycle**: Complete control over module progression (`load` → `check` → `init` → `register` → `bind events`).
- **Automatic Event Binding**: Declaratively map event listeners to a target emitter, ensuring they are automatically rebound on
  reload and removed on unload to prevent memory leaks.
- **Resource Cleanup**: Provides an `AbortSignal` to loaded modules. Modules can listen to the `abort` event to clean up timers,
  WebSocket connections, streams, or databases.
- **Hot-Reload Watcher**: Built-in file and directory watcher that handles file additions, modifications (reloads), and deletions
  (unloads) with customizable debouncing.
- **Dual ESM & CommonJS Loader**: Transparently loads CommonJS (`.cjs`, `.json`, `.js`) and ESM (`.mjs`, `.js`) files,
  invalidating the CommonJS require cache on reload.

## Installation

```bash
pnpm add @ziji/loader
```

## Quick Start

### 1. Initialize the Loader

```typescript
import { Loader } from "@ziji/loader";
import { EventEmitter } from "node:events";

const eventBus = new EventEmitter();

const loader = new Loader({
	extensions: [".js", ".ts"],
	watch: true, // Enable watch mode
	debounce: 150, // Debounce watch triggers (ms)
	events: eventBus, // Global event target for binding
	init: true, // Automatically run the init lifecycle method
});

// Configure custom extension loading / validation
loader.define({
	extension: ".plugin.js",
	check: (module) => typeof module.execute === "function",
});

// Load modules recursively
await loader.load("./plugins");
```

### 2. Creating a Lifecycle Module

Export an object containing standard lifecycle methods. Use `ctx.signal` to clean up async tasks.

```typescript
// plugins/logger.js
export default {
	async init(ctx) {
		console.log(`[${ctx.name}] loading...`);

		const timer = setInterval(() => {
			console.log("Heartbeat working");
		}, 1000);

		// Clean up when the module is reloaded or unloaded
		ctx.signal.addEventListener(
			"abort",
			() => {
				clearInterval(timer);
				console.log(`[${ctx.name}] cleaned up`);
			},
			{ once: true },
		);
	},

	// Event handlers mapped automatically
	onReady() {
		console.log("System is ready!");
	},

	onMessage(msg) {
		console.log("New message:", msg);
	},

	execute() {
		// Custom plugin logic
	},
};
```

### 3. Declarative Event Mappings

Configure event-to-method mapping when loading the module or in the global loader options:

```typescript
const loader = new Loader({
	events: eventBus,
	on: {
		ready: "onReady",
		message: "onMessage",
	},
});
```

When `logger.js` is loaded, its `onReady` and `onMessage` methods are automatically bound to the `eventBus`. When the file
changes:

1. The watcher detects the change.
2. The old module's event listeners are removed from the `eventBus`.
3. The old module's `AbortSignal` is aborted (clearing the interval timer).
4. The CommonJS cache for the file is invalidated.
5. The new file is loaded, validated, initialized, registered, and its event listeners are bound to the `eventBus`.

## API Reference

### Loader Options

- `watch?: boolean` - Watch file/folder changes (default: `false`).
- `debounce?: number` - Debounce file changes in ms (default: `100`).
- `recursive?: boolean` - Recursively search folders (default: `true`).
- `extensions?: string[]` - Supported extensions (default: `[".js", ".cjs", ".mjs"]`).
- `events?: EventTarget` - Default EventTarget to bind listener methods.
- `on?: Record<string, string | Function>` - Event names mapped to module methods or handler functions.
- `once?: Record<string, string | Function>` - One-time event mappings.
- `check?: (module, context) => boolean | Promise<boolean>` - Custom validation function.
- `init?: boolean | ((module, context) => void | Promise<void>)` - Run `init()` on load.

### Loader Methods

- `load(target: string, options?)` - Load a file or directory.
- `reload(name: string)` - Reload a loaded module by its resolved name.
- `unload(name: string)` - Unload a module, aborting its signal and unbinding events.
- `get(name: string)` - Get the raw exported module.
- `getLoaded(name: string)` - Get complete module metadata (`LoadedModule`).
- `destroy()` - Unloads all modules and closes the file watcher.

### Loader Events

The `Loader` class extends `EventEmitter` and emits the following lifecycle events:

- `load` - Emitted when a module is successfully loaded.
- `unload` - Emitted when a module is unloaded.
- `reload` - Emitted when a module is reloaded.
- `error` - Emitted when a module fails validation or loading throws an error.
- `watch` - Emitted when watching a path starts.
- `unwatch` - Emitted when watching a path stops.
- `change` - Emitted when a watched file is modified.
