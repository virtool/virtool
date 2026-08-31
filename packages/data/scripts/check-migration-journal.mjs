import { readFile } from "node:fs/promises";

const journalPath = new URL("../drizzle/meta/_journal.json", import.meta.url);
const journal = JSON.parse(await readFile(journalPath, "utf8"));

for (let index = 1; index < journal.entries.length; index++) {
	const previous = journal.entries[index - 1];
	const current = journal.entries[index];

	if (current.when <= previous.when) {
		throw new Error(
			`Migration journal timestamps must increase: ${current.tag} follows ${previous.tag}`,
		);
	}
}
