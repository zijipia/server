import fs from "node:fs/promises";
import path from "node:path";
import { createProjectTemplate } from "../templates/project.js";

export interface CreateProjectOptions {
	readonly targetDirectory: string;
	readonly name: string;
	readonly force?: boolean;
}

export interface CreateProjectResult {
	readonly targetDirectory: string;
	readonly createdFiles: readonly string[];
}

async function directoryIsEmpty(directory: string): Promise<boolean> {
	try {
		const entries = await fs.readdir(directory);
		return entries.length === 0;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return true;
		}

		throw error;
	}
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
	const targetDirectory = path.resolve(options.targetDirectory);
	const isEmpty = await directoryIsEmpty(targetDirectory);

	if (!isEmpty && !options.force) {
		throw new Error(
			`@ziji/cli create: target directory "${targetDirectory}" is not empty. Use --force to scaffold anyway.`,
		);
	}

	await fs.mkdir(targetDirectory, { recursive: true });

	const files = createProjectTemplate({ name: options.name });
	const createdFiles: string[] = [];

	for (const file of files) {
		const absolutePath = path.join(targetDirectory, file.relativePath);
		await fs.mkdir(path.dirname(absolutePath), { recursive: true });
		await fs.writeFile(absolutePath, file.content, "utf8");
		createdFiles.push(file.relativePath);
	}

	return {
		targetDirectory,
		createdFiles,
	};
}
