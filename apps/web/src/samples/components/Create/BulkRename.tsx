import { pluralize } from "@app/format";
import { BoxGroupSection } from "@base/Box";
import Button, { ButtonToggle } from "@base/Button";
import { InputSimple } from "@base/Input";
import Popover from "@base/Popover";
import Tooltip from "@base/Tooltip";
import { Info, Regex, ReplaceAll } from "lucide-react";
import { useId } from "react";

type BulkRenameProps = {
	canUndo: boolean;
	isRegex: boolean;
	match: string;
	names: string[];
	onRename: (names: string[]) => void;
	onRegexChange: (isRegex: boolean) => void;
	onMatchChange: (match: string) => void;
	onReplacementChange: (replacement: string) => void;
	onUndo: () => void;
	replacement: string;
};

export default function BulkRename({
	canUndo,
	isRegex,
	match,
	names,
	onMatchChange,
	onRegexChange,
	onRename,
	onReplacementChange,
	onUndo,
	replacement,
}: BulkRenameProps) {
	const errorId = useId();
	const { pattern, error } = getPattern(match, isRegex);
	const renamed = names.map((name) => {
		if (!match || !pattern) {
			return name;
		}
		return isRegex
			? name.replace(pattern, replacement)
			: name.replace(pattern, (matched) => (matched ? replacement : ""));
	});
	const changedCount = renamed.filter(
		(name, index) => name !== names[index],
	).length;

	return (
		<BoxGroupSection className="flex min-h-14 flex-wrap items-center gap-2 bg-gray-50 py-2 text-sm text-gray-600">
			<span className="mr-2 shrink-0 font-medium" aria-live="polite">
				{pluralize(names.length, "sample")}
			</span>
			<fieldset
				aria-label="Bulk rename"
				className="ml-auto flex min-w-0 items-center rounded shadow-xs"
			>
				<InputSimple
					aria-label="Match text"
					aria-invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
					className="h-9 w-50 min-w-0 max-w-50 rounded-r-none focus-visible:z-10"
					placeholder="Match"
					value={match}
					onChange={(event) => onMatchChange(event.target.value)}
				/>
				<InputSimple
					aria-label="Replacement"
					className="-ml-px h-9 w-50 min-w-0 max-w-50 rounded-none focus-visible:z-10"
					placeholder="Replacement"
					value={replacement}
					onChange={(event) => onReplacementChange(event.target.value)}
				/>
				<Tooltip tip="Use regular expression">
					<ButtonToggle
						aria-label="Use regular expression"
						pressed={isRegex}
						onPressedChange={onRegexChange}
						className="relative -ml-px h-9 min-h-9 w-9 shrink-0 justify-center rounded-none border border-gray-300 bg-white px-0 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:z-10 focus-visible:ring-offset-0"
					>
						<Regex aria-hidden="true" size={16} />
					</ButtonToggle>
				</Tooltip>
				<Tooltip tip={`Replace in ${pluralize(changedCount, "name")}`}>
					<Button
						size="small"
						aria-label={`Replace in ${pluralize(changedCount, "name")}`}
						className="relative -ml-px h-9 shrink-0 justify-center rounded-l-none rounded-r border border-gray-300 bg-white hover:bg-gray-100 focus-visible:z-10 focus-visible:ring-offset-0 disabled:cursor-default disabled:opacity-100 disabled:text-gray-400 disabled:hover:bg-white disabled:hover:text-gray-400 disabled:active:brightness-100"
						disabled={changedCount === 0}
						onClick={() => onRename(renamed)}
					>
						<ReplaceAll aria-hidden="true" size={16} />
						{changedCount > 0 && pluralize(changedCount, "name")}
					</Button>
				</Tooltip>
			</fieldset>
			{canUndo && (
				<Button size="small" onClick={onUndo}>
					Undo rename
				</Button>
			)}
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
					delete matches. Enable regular expressions to use patterns such as
					^sample_ or (.*)_batch. Enter patterns without slash delimiters. Use
					$1, $2, and so on in the replacement for captured groups.
				</p>
			</Popover>
			{error && (
				<p id={errorId} role="alert" className="w-full text-red-600">
					{error}
				</p>
			)}
		</BoxGroupSection>
	);
}

function getPattern(match: string, isRegex: boolean) {
	try {
		const source = isRegex
			? match
			: match
					.split(/\*+/)
					.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
					.join(".*");
		return { pattern: new RegExp(source, "g"), error: null };
	} catch {
		return { pattern: null, error: "Enter a valid regular expression." };
	}
}
