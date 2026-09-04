import { pluralize } from "@app/format";
import { BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import { InputSimple } from "@base/Input";
import Popover from "@base/Popover";
import Tooltip from "@base/Tooltip";
import { Info, ReplaceAll } from "lucide-react";
import { useState } from "react";

type BulkRenameProps = {
	names: string[];
	onRename: (names: string[]) => void;
};

export default function BulkRename({ names, onRename }: BulkRenameProps) {
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
		<BoxGroupSection className="flex h-14 items-center gap-2 bg-gray-50 py-0 text-sm text-gray-600">
			<span className="mr-2 shrink-0 font-medium" aria-live="polite">
				{pluralize(names.length, "sample")}
			</span>
			<fieldset
				aria-label="Bulk rename"
				className="ml-auto flex min-w-0 items-center rounded shadow-xs"
			>
				<InputSimple
					aria-label="Match text"
					className="h-9 w-50 min-w-0 max-w-50 rounded-r-none focus-visible:z-10"
					placeholder="Match"
					value={match}
					onChange={(event) => setMatch(event.target.value)}
				/>
				<InputSimple
					aria-label="Replacement"
					className="-ml-px h-9 w-50 min-w-0 max-w-50 rounded-none focus-visible:z-10"
					placeholder="Replacement"
					value={replacement}
					onChange={(event) => setReplacement(event.target.value)}
				/>
				<Tooltip tip="Replace all">
					<Button
						size="small"
						aria-label="Replace all"
						className="relative -ml-px h-9 w-9 shrink-0 justify-center px-0 rounded-l-none rounded-r border border-gray-300 bg-white hover:bg-gray-100 focus-visible:z-10 focus-visible:ring-offset-0 disabled:cursor-default disabled:opacity-100 disabled:text-gray-400 disabled:hover:bg-white disabled:hover:text-gray-400 disabled:active:brightness-100"
						disabled={changedCount === 0}
						onClick={() => onRename(renamed)}
					>
						<ReplaceAll aria-hidden="true" size={16} />
					</Button>
				</Tooltip>
			</fieldset>
			<Popover
				align="end"
				alignOffset={0}
				trigger={
					<button
						type="button"
						aria-label="Bulk rename help"
						className="shrink-0 cursor-pointer rounded p-1 text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-500"
					>
						<Info aria-hidden="true" size={16} />
					</button>
				}
			>
				<p className="p-3 text-sm text-gray-600">
					Replace matching text in all sample names. Matching is case-sensitive.
					Use * for any number of characters. Leave the replacement empty to
					delete matches.
				</p>
			</Popover>
		</BoxGroupSection>
	);
}
