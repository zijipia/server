# @ziji/loader

A lightweight TypeScript module loader for Node.js.

`@ziji/loader` loads JavaScript/TypeScript-built modules from files or directories and provides:

- File and directory loading
- Recursive directory scanning
- Custom file extensions
- Custom module loaders
- Custom module names
- Module validation
- Module initialization
- Event binding with `on` / `once`
- File watching
- Hot reload
- Automatic cleanup with `AbortSignal`
- CommonJS and ESM support
- Atomic reload

The package is designed to be a small foundation for plugin systems, command loaders, service loaders, and other dynamic module
systems.

---

## Installation

```bash
pnpm add @ziji/loader
```

or:

```bash
npm install @ziji/loader
```

---

# Quick Start

Create a directory:

```text
plugins/
├── hello.js
└── math.js
```

`plugins/hello.js`:

```js
export default {
	name: "hello",

	execute() {
		console.log("Hello!");
	},
};
```

Load the directory:

```ts
import { Loader } from "@ziji/loader";

const loader = new Loader();

await loader.load("./plugins");

const hello = loader.get("hello");

hello?.execute();
```

By default, modules are named from their relative file path.

For example:

```text
plugins/
└── hello.js
```

becomes:

```ts
loader.get("hello");
```

A nested file:

```text
plugins/
└── math/
    └── add.js
```

becomes:

```ts
loader.get("math/add");
```

---

# Loading Files

A loader can load either a single file:

```ts
await loader.load("./plugins/hello.js");
```

or an entire directory:

```ts
await loader.load("./plugins");
```

Directories are recursively scanned by default.

---

# Loading Directories

Given:

```text
plugins/
├── foo.js
├── bar.js
└── commands/
    ├── ping.js
    └── help.js
```

```ts
await loader.load("./plugins");
```

loads:

```text
foo.js
bar.js
commands/ping.js
commands/help.js
```

The resulting names are:

```ts
loader.get("foo");
loader.get("bar");
loader.get("commands/ping");
loader.get("commands/help");
```

## Disable recursion

```ts
const loader = new Loader({
	recursive: false,
});
```

Only files directly inside the target directory are loaded.

---

# File Extensions

By default, the loader supports:

```text
.js
.cjs
.mjs
```

You can define your own extensions:

```ts
const loader = new Loader({
	extensions: [".js", ".mjs", ".plugin.js"],
});
```

This allows files such as:

```text
plugins/
├── music.plugin.js
├── logger.plugin.js
└── database.plugin.js
```

---

# Custom Extensions

Use `define()` when an extension needs custom loading or validation.

```ts
const loader = new Loader();

loader.define({
	extension: ".plugin.js",

	check(module) {
		return typeof module === "object" && module !== null && typeof module.execute === "function";
	},
});
```

Now every `.plugin.js` module must provide an `execute()` function.

---

# Custom Module Loader

A custom loader can transform the file before it is registered.

```ts
loader.define({
	extension: ".json",

	async load(filePath) {
		const text = await fs.promises.readFile(filePath, "utf8");

		return JSON.parse(text);
	},
});
```

The custom loader receives:

```ts
{
	(path, extension);
}
```

---

# Naming

By default, names are generated from the relative file path.

```text
plugins/
├── foo.js
└── commands/
    └── ping.js
```

produces:

```ts
foo;
commands / ping;
```

## Fixed name

You can specify a fixed name when loading a module:

```ts
await loader.load("./plugins/foo.js", {
	name: "my-plugin",
});
```

Then:

```ts
loader.get("my-plugin");
```

## Custom name resolver

For directory loading:

```ts
const loader = new Loader({
	name(filePath, context) {
		return context.relativePath.replaceAll("\\", "/").replace(/\.(mjs|cjs|js)$/, "");
	},
});
```

The resolver receives:

```ts
{
	(root, relativePath, extension, module);
}
```

---

# Validation

Use `check` to validate a module before registering it.

```ts
const loader = new Loader({
	check(module) {
		return typeof module === "object" && module !== null && typeof module.execute === "function";
	},
});
```

If validation fails, the module is not loaded.

You can also define validation for a specific extension:

```ts
loader.define({
	extension: ".plugin.js",

	check(module) {
		return typeof module.execute === "function";
	},
});
```

Per-load validation overrides the global validation:

```ts
await loader.load("./plugins", {
	check(module) {
		return Boolean(module);
	},
});
```

---

# Initialization

Modules can optionally expose an `init()` function.

```js
export default {
	async init(ctx) {
		console.log("Plugin initialized");
	},
};
```

Enable automatic initialization:

```ts
const loader = new Loader({
	init: true,
});
```

The loader calls:

```ts
module.init(ctx);
```

after validation and before the module becomes active.

---

# Initialization Function

You can also provide initialization externally:

```ts
const loader = new Loader({
	init(module, ctx) {
		console.log(`Loaded ${ctx.name}`);
	},
});
```

The initialization context contains:

```ts
{
	(name, path, root, module, loader, signal);
}
```

---

# AbortSignal and Cleanup

Every loaded module receives an `AbortSignal`.

This allows modules to clean up resources when they are unloaded or reloaded.

```js
export default {
	init(ctx) {
		const timer = setInterval(() => {
			console.log("working...");
		}, 1000);

		ctx.signal.addEventListener(
			"abort",
			() => {
				clearInterval(timer);

				console.log("plugin cleaned up");
			},
			{ once: true },
		);
	},
};
```

When the module is unloaded:

```ts
await loader.unload("my-plugin");
```

the loader aborts its signal.

This makes it possible to clean up:

- Timers
- Intervals
- Streams
- WebSockets
- Event listeners
- Async tasks
- Other resources owned by the module

The module receives only:

```ts
ctx.signal;
```

The internal `AbortController` is owned by the loader.

---

# Events

The loader can automatically bind module methods to an `EventEmitter`.

```ts
import { EventEmitter } from "node:events";

const events = new EventEmitter();

const loader = new Loader({
	events,

	on: {
		ready: "onReady",
		message: "onMessage",
	},
});
```

Module:

```js
export default {
	onReady() {
		console.log("Ready!");
	},

	onMessage(message) {
		console.log(message);
	},
};
```

The loader effectively performs:

```ts
events.on("ready", module.onReady.bind(module));

events.on("message", module.onMessage.bind(module));
```

---

# `once` Events

Use `once` for one-time listeners:

```ts
const loader = new Loader({
	events,

	once: {
		ready: "onReady",
	},
});
```

This behaves like:

```ts
events.once("ready", module.onReady);
```

---

# Event Cleanup

Event listeners created by the loader are automatically removed when the module is unloaded.

```ts
await loader.unload("my-plugin");
```

The loader removes only the listeners belonging to that module.

This also happens during hot reload.

---

# Watch Mode

Enable file watching:

```ts
const loader = new Loader({
	watch: true,
});

await loader.load("./plugins");
```

The loader watches the directory for changes.

When a file changes:

```text
file changed
     ↓
detect change
     ↓
reload module
```

---

# Hot Reload

Suppose:

```text
plugins/
└── counter.js
```

contains:

```js
export default {
	version: 1,
};
```

After:

```ts
await loader.load("./plugins", {
	watch: true,
});
```

changing the file to:

```js
export default {
	version: 2,
};
```

automatically reloads the module.

```ts
loader.get("counter");
```

now returns the new module.

---

# Reload Lifecycle

A reload is performed atomically.

Conceptually:

```text
             old module
                 │
                 │
          load new module
                 │
           ┌─────┴─────┐
           │           │
          fail       success
           │           │
     keep old       validate
                       │
                      init
                       │
                 bind events
                       │
                  swap module
                       │
                 cleanup old
```

This means a broken update does not immediately destroy a working module.

For example, if the new file contains a syntax error:

```text
old module
    ↓
new module fails
    ↓
old module remains active
```

---

# Watch Configuration

You can configure the debounce interval:

```ts
const loader = new Loader({
	watch: true,
	debounce: 150,
});
```

`debounce` prevents multiple filesystem events from causing multiple reloads.

---

# Ignore Files

Use `ignore` to exclude files or directories:

```ts
const loader = new Loader({
	ignore(path, isDirectory) {
		return path.includes("node_modules") || path.includes(".git");
	},
});
```

---

# Unwatch

Stop watching a target:

```ts
loader.unwatch("./plugins");
```

The loaded modules are not automatically removed.

`unwatch()` only stops filesystem watching.

To remove modules:

```ts
await loader.clear();
```

---

# Module Registry

Check whether a module exists:

```ts
loader.has("foo");
```

Get a module:

```ts
const foo = loader.get("foo");
```

Get module metadata:

```ts
const loaded = loader.getLoaded("foo");
```

The metadata contains:

```ts
{
	(name, path, module, context, initialized);
}
```

List module names:

```ts
loader.keys();
```

List modules:

```ts
loader.values();
```

List name/module pairs:

```ts
loader.entries();
```

---

# Unload

Unload a single module:

```ts
await loader.unload("foo");
```

The loader will:

1. Remove registered event listeners
2. Abort the module's `AbortSignal`
3. Remove it from the registry
4. Invalidate its CommonJS cache

---

# Clear

Remove all loaded modules:

```ts
await loader.clear();
```

---

# Destroy

Completely shut down the loader:

```ts
await loader.destroy();
```

This:

- Unloads all modules
- Aborts module resources
- Removes event listeners
- Stops file watchers
- Clears watcher state

After `destroy()`, the loader should no longer be used.

---

# Loading Result

`load()` returns:

```ts
{
	(loaded, failed);
}
```

Example:

```ts
const result = await loader.load("./plugins");

console.log(result.loaded);
console.log(result.failed);
```

Each loaded module contains:

```ts
{
	(name, path, module, context, initialized);
}
```

When:

```ts
throwOnError: false;
```

failed modules are returned through `failed` instead of immediately aborting the entire directory load.

---

# Error Handling

By default:

```ts
const loader = new Loader({
	throwOnError: true,
});
```

A loading error stops the operation.

For directory loading where individual failures should be collected:

```ts
const loader = new Loader({
	throwOnError: false,
});
```

Then:

```ts
const result = await loader.load("./plugins");

for (const failure of result.failed) {
	console.error(failure.path, failure.error);
}
```

---

# Complete Example

```ts
import { EventEmitter } from "node:events";
import { Loader } from "@ziji/loader";

const events = new EventEmitter();

const loader = new Loader({
	recursive: true,

	extensions: [".js", ".mjs", ".cjs"],

	watch: true,

	debounce: 150,

	events,

	init: true,

	check(module) {
		return typeof module === "object" && module !== null;
	},

	on: {
		ready: "onReady",
	},

	once: {
		startup: "onStartup",
	},
});

await loader.load("./plugins");

console.log(loader.keys());
```

Example plugin:

```js
export default {
	async init(ctx) {
		console.log(`Loaded ${ctx.name}`);

		const timer = setInterval(() => {
			console.log("running");
		}, 1000);

		ctx.signal.addEventListener(
			"abort",
			() => {
				clearInterval(timer);

				console.log(`${ctx.name} stopped`);
			},
			{ once: true },
		);
	},

	onReady() {
		console.log("Ready");
	},

	onStartup() {
		console.log("Startup");
	},
};
```

---

# Lifecycle

The normal module lifecycle is:

```text
                  load()
                    │
                    ▼
              resolve file
                    │
                    ▼
              load module
                    │
                    ▼
                 check
                    │
                    ▼
                  init
                    │
                    ▼
             register module
                    │
                    ▼
              bind events
                    │
                    ▼
                 active
                    │
          ┌─────────┴─────────┐
          │                   │
        unload              reload
          │                   │
          ▼                   ▼
      unbind events      load new module
          │                   │
          ▼                 check
       abort                init
          │                 bind
          ▼                   │
       removed          atomic swap
                              │
                              ▼
                         cleanup old
```

---

# Supported Module Formats

The default loader supports:

| Extension | Format         |
| --------- | -------------- |
| `.js`     | CommonJS / ESM |
| `.cjs`    | CommonJS       |
| `.mjs`    | ESM            |

Custom extensions can be added with `define()`.

---

# Design Goals

`@ziji/loader` intentionally focuses on a small set of responsibilities:

- Discover modules
- Load modules
- Validate modules
- Initialize modules
- Manage module lifecycle
- Bind module events
- Watch and reload modules
- Clean up resources

It does **not** try to become a complete dependency injection framework or plugin framework.

Higher-level systems can build on top of the loader.

---

# API

## `Loader`

```ts
new Loader(options?)
```

### Methods

```ts
load(target, options?)
get(name)
getLoaded(name)
has(name)
keys()
values()
entries()

define(definition)

unload(name)
clear()
reload(name)

watch(target)
unwatch(target)

destroy()
```

---

# TypeScript

The package is written in TypeScript and exports its public types:

```ts
import type { LoaderOptions, LoadOptions, LoadedModule, LoaderContext, ExtensionDefinition } from "@ziji/loader";
```

---

# License

MIT
