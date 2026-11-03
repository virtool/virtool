// Finds the workspaces that a branch changes in a way that can ship, and the
// workspaces that they reach through the workspace graph. The release check
// and the Renovate change-file task share these rules, so that a branch never
// needs a change file that Renovate does not write.
//
// Only Node built-ins and `git` are used, because the Renovate image has no
// `pnpm` and no installed dependencies.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Test and type tools never reach a bundle. Other development dependencies,
// such as Vite, Nitro, or Tailwind, change the shipped build output.
const testTools = [
	"@faker-js/faker",
	"@testing-library/*",
	"@types/*",
	"@vitest/*",
	"axe-core",
	"jsdom",
	"playwright",
	"vitest",
];

const dependencyFields = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
];

export function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function lines(output) {
	return output.split("\n").filter(Boolean);
}

function isTestTool(name) {
	return testTools.some((pattern) =>
		pattern.endsWith("/*")
			? name.startsWith(pattern.slice(0, -1))
			: name === pattern,
	);
}

// Apps bundle, but packages stay source, so the development dependencies of a
// package only serve its own tests and types.
export function isShippedDependency(dir, depType, name) {
	return (
		!isTestTool(name) &&
		!(depType === "devDependencies" && dir.startsWith("packages/"))
	);
}

// Tests, test data, test configuration, and Markdown are not in any image.
export function isShippedFile(file) {
	const segments = file.split("/");
	const name = segments.at(-1);

	return !(
		/\.(test|spec)\.[cm]?[jt]sx?$/.test(name) ||
		/^vitest\.config\.[cm]?[jt]s$/.test(name) ||
		name.endsWith(".md") ||
		segments.some((segment) =>
			["__tests__", "fixtures", "test", "testing", "tests"].includes(segment),
		)
	);
}

// The working tree compared with the base, so that the files a Renovate task
// leaves uncommitted count too.
export function getChangedFiles(base) {
	return [
		...new Set([
			...lines(git("diff", "--name-only", "--no-relative", base)),
			...lines(git("ls-files", "--others", "--exclude-standard")),
		]),
	];
}

function readWorkspaces(root) {
	const workspaces = [];

	for (const parent of ["apps", "packages"]) {
		for (const entry of readdirSync(join(root, parent), {
			withFileTypes: true,
		})) {
			const dir = join(parent, entry.name);
			const manifest = join(root, dir, "package.json");

			if (!entry.isDirectory() || !existsSync(manifest)) {
				continue;
			}

			const json = JSON.parse(readFileSync(manifest, "utf8"));

			workspaces.push({
				name: json.name,
				dir,
				deps: dependencyFields.flatMap((field) =>
					Object.keys(json[field] ?? {}),
				),
			});
		}
	}

	return workspaces;
}

function readBaseManifest(base, file) {
	try {
		return JSON.parse(git("show", `${base}:${file}`));
	} catch {
		return undefined;
	}
}

// A manifest change ships unless it only changes dependencies that ship
// nothing.
function isShippedManifestChange(root, base, dir, file) {
	const before = readBaseManifest(base, file);

	if (!before || !existsSync(join(root, file))) {
		return true;
	}

	const after = JSON.parse(readFileSync(join(root, file), "utf8"));

	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (!dependencyFields.includes(key)) {
			if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
				return true;
			}

			continue;
		}

		const old = before[key] ?? {};
		const now = after[key] ?? {};

		for (const name of new Set([...Object.keys(old), ...Object.keys(now)])) {
			if (old[name] !== now[name] && isShippedDependency(dir, key, name)) {
				return true;
			}
		}
	}

	return false;
}

function reach(workspaces, dirs) {
	const names = new Set(
		workspaces.filter((w) => dirs.includes(w.dir)).map((w) => w.name),
	);
	let size;

	do {
		size = names.size;

		for (const workspace of workspaces) {
			if (workspace.deps.some((dep) => names.has(dep))) {
				names.add(workspace.name);
			}
		}
	} while (names.size !== size);

	return workspaces.filter((w) => names.has(w.name)).map((w) => w.dir);
}

// The workspaces, and every workspace that depends on them.
export function getReachedDirs(root, dirs) {
	return reach(readWorkspaces(root), dirs);
}

// The workspaces with a shipped change, and every workspace that depends on
// them, as `pnpm --filter "...[ref]"` finds.
export function getAffectedDirs(root, base, changed) {
	const workspaces = readWorkspaces(root);
	const dirs = new Set();

	for (const file of changed) {
		const workspace = workspaces.find(({ dir }) => file.startsWith(`${dir}/`));

		if (
			workspace &&
			isShippedFile(file) &&
			(file !== `${workspace.dir}/package.json` ||
				isShippedManifestChange(root, base, workspace.dir, file))
		) {
			dirs.add(workspace.dir);
		}
	}

	return reach(workspaces, [...dirs]);
}
