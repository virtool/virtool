import Button from "@base/Button";
import { InputLabel, InputSimple } from "@base/Input";
import { useId, useState } from "react";

type BulkRenameProps = {
	names: string[];
	onRename: (names: string[]) => void;
};

export default function BulkRename({ names, onRename }: BulkRenameProps) {
	const id = useId();
	const [match, setMatch] = useState("");
	const [replacement, setReplacement] = useState("");
	const pattern = new RegExp(
		match
			.split(/\*+/)
			.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join(".*"),
		"g",
	);
	const renamed = names.map((name) =>
		match
			? name.replace(pattern, (matched) => (matched ? replacement : ""))
			: name,
	);
	const changedCount = renamed.filter(
		(name, index) => name !== names[index],
	).length;

	return (
		<fieldset className="mb-4 rounded-lg border border-gray-300 p-4">
			<legend className="px-1 font-medium">Bulk rename</legend>
			<p id={`${id}-help`} className="mb-3 text-sm text-gray-500">
				Match text is case-sensitive. Use * for any number of characters. Leave
				the replacement empty to delete matches from all names.
			</p>
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-0 flex-1">
					<InputLabel htmlFor={`${id}-match`}>Match text</InputLabel>
					<InputSimple
						id={`${id}-match`}
						aria-describedby={`${id}-help`}
						value={match}
						onChange={(event) => setMatch(event.target.value)}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<InputLabel htmlFor={`${id}-replacement`}>Replace with</InputLabel>
					<InputSimple
						id={`${id}-replacement`}
						value={replacement}
						onChange={(event) => setReplacement(event.target.value)}
					/>
				</div>
				<Button
					type="button"
					disabled={changedCount === 0}
					onClick={() => onRename(renamed)}
				>
					Apply rename
				</Button>
			</div>
			<p className="mt-3 text-sm text-gray-500" aria-live="polite">
				{changedCount} {changedCount === 1 ? "name" : "names"} will change.
			</p>
		</fieldset>
	);
}
