import path from "node:path";

export function normalizeExtension(extension: string): string {
	if (!extension.startsWith(".")) {
		return `.${extension}`;
	}

	return extension;
}

export function normalizeExtensions(extensions: string[]): string[] {
	return [...new Set(extensions.map(normalizeExtension))];
}

/**
 * Handles compound extensions such as:
 *
 * .plugin.js
 * .command.js
 */
export function matchesExtension(filePath: string, extensions: string[]): boolean {
	const lowerPath = filePath.toLowerCase();

	return extensions.some((extension) => {
		return lowerPath.endsWith(extension.toLowerCase());
	});
}

export function getMatchedExtension(filePath: string, extensions: string[]): string | undefined {
	const lowerPath = filePath.toLowerCase();

	return extensions.find((extension) => lowerPath.endsWith(extension.toLowerCase()));
}

export function defaultName(root: string, filePath: string): string {
	const relative = path.relative(root, filePath);

	const parsed = path.parse(relative);

	return path.join(parsed.dir, parsed.name).split(path.sep).join("/");
}

export function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
}
