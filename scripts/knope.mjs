import { readFileSync } from "node:fs";
import { join } from "node:path";

// Maps each file in a `versioned_files` list of `knope.toml` to the name of
// its Knope package.
export function readKnopePackages(root) {
	const packages = new Map();
	let name;

	for (const line of readFileSync(join(root, "knope.toml"), "utf8").split(
		"\n",
	)) {
		const header = line.match(/^\[(.+)\]\s*$/);

		if (header) {
			name = header[1].match(/^packages\.([\w-]+)$/)?.[1];
			continue;
		}

		const files = line.match(/^versioned_files\s*=\s*\[(.*)\]/);

		if (name && files) {
			for (const [, file] of files[1].matchAll(/"([^"]+)"/g)) {
				packages.set(file, name);
			}
		}
	}

	return packages;
}
