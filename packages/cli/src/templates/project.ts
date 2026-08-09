export interface ProjectTemplateOptions {
	readonly name: string;
}

export interface ProjectTemplateFile {
	readonly relativePath: string;
	readonly content: string;
}

export function createProjectTemplate(options: ProjectTemplateOptions): ProjectTemplateFile[] {
	const { name } = options;

	return [
		{
			relativePath: "package.json",
			content: `${JSON.stringify(
				{
					name,
					version: "0.0.0",
					private: true,
					type: "module",
					scripts: {
						dev: "tsx watch src/index.ts",
						start: "node dist/index.js",
						build: "tsc -p tsconfig.json",
						typecheck: "tsc -p tsconfig.json --noEmit",
					},
					dependencies: {
						"@ziji/server": "^0.0.0",
					},
					devDependencies: {
						"@types/node": "^20.11.0",
						tsx: "^4.7.0",
						typescript: "^5.6.0",
					},
				},
				null,
				"\t",
			)}\n`,
		},
		{
			relativePath: "tsconfig.json",
			content: `{
\t"compilerOptions": {
\t\t"target": "ES2020",
\t\t"module": "ESNext",
\t\t"moduleResolution": "Bundler",
\t\t"lib": ["ES2020"],
\t\t"types": ["node"],
\t\t"outDir": "dist",
\t\t"rootDir": "src",
\t\t"strict": true,
\t\t"esModuleInterop": true,
\t\t"skipLibCheck": true,
\t\t"resolveJsonModule": true
\t},
\t"include": ["src"]
}
`,
		},
		{
			relativePath: ".gitignore",
			content: `node_modules/
dist/
.env
*.log
`,
		},
		{
			relativePath: ".env.example",
			content: `NODE_ENV=development
`,
		},
		{
			relativePath: "src/index.ts",
			content: `import { Server } from "@ziji/server";

const server = new Server({
\tstartupDirectory: "./startup",
\tdev: process.env.NODE_ENV !== "production",
\tkeepAlive: true,
});

server.app.events.on("app:ready", () => {
\tconsole.log("[${name}] server is ready");
});

await server.boot();
`,
		},
		{
			relativePath: "startup/010-config.ts",
			content: `import { getApp } from "@ziji/server";

export default async function setupConfig() {
\tconst app = getApp();
\tconsole.log("[startup:010-config] app singleton ready", typeof app.events.on === "function");
}
`,
		},
		{
			relativePath: "startup/020-plugins.ts",
			content: `import { getApp } from "@ziji/server";

export const priority = 20;

export default async function registerPlugins() {
\tconst app = getApp();
\tconsole.log("[startup:020-plugins] register plugins here via app.register(...)");
\tvoid app;
}
`,
		},
		{
			relativePath: "routes/.gitkeep",
			content: "",
		},
		{
			relativePath: "README.md",
			content: `# ${name}

Project scaffolded with \`@ziji/cli\`.

## Structure

- \`src/index.ts\` — entry point using \`@ziji/server\`
- \`startup/\` — bootstrap scripts run by priority before plugins boot
- \`routes/\` — optional HTTP routes when using \`pluginRouter\`

## Commands

\`\`\`bash
pnpm install
pnpm dev
pnpm build
pnpm start
\`\`\`
`,
		},
	];
}
