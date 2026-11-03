import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads each `[packages.<name>]` table of `knope.toml` as
// `{ name, files, changelog }`, in file order.
export function readKnopeConfig(root) {
	const packages = [];
	let current;

	for (const line of readFileSync(join(root, "knope.toml"), "utf8").split(
		"\n",
	)) {
		const header = line.match(/^\[(.+)\]\s*$/);

		if (header) {
			const name = header[1].match(/^packages\.([\w-]+)$/)?.[1];
			current = name ? { name, files: [], changelog: undefined } : undefined;

			if (current) {
				packages.push(current);
			}

			continue;
		}

		if (!current) {
			continue;
		}

		const files = line.match(/^versioned_files\s*=\s*\[(.*)\]/);

		if (files) {
			current.files = [...files[1].matchAll(/"([^"]+)"/g)].map(
				([, file]) => file,
			);
			continue;
		}

		const changelog = line.match(/^changelog\s*=\s*"([^"]+)"/);

		if (changelog) {
			current.changelog = changelog[1];
		}
	}

	return packages;
}

// Maps each file in a `versioned_files` list of `knope.toml` to the name of
// its Knope package.
export function readKnopePackages(root) {
	const packages = new Map();

	for (const { name, files } of readKnopeConfig(root)) {
		for (const file of files) {
			packages.set(file, name);
		}
	}

	return packages;
}
