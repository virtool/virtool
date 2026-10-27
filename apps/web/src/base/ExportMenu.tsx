import { writeToClipboard } from "@app/clipboard";
import { useIsSecureContext, useTimedReset } from "@app/hooks";
import Dropdown, {
	DropdownMenuContent,
	DropdownMenuDownload,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuLink,
	DropdownMenuSeparator,
} from "@base/Dropdown";
import Icon from "@base/Icon";
import * as Sentry from "@sentry/tanstackstart-react";
import { ClipboardCopy, type LucideIcon, Settings } from "lucide-react";
import { type ReactNode, useState } from "react";

/** One entry in an export menu's Copy group. */
export type ExportCopyItem = {
	disabled?: boolean;
	label: string;
	onSelect: () => void;
};

/** One entry in an export menu's Download group, either a link or a handler. */
export type ExportDownloadItem = {
	icon: LucideIcon;
	label: string;
} & ({ href: string } | { disabled?: boolean; onSelect: () => void });

type ExportMenuProps = {
	/** Options shown between the Download group and the Settings link */
	children: ReactNode;

	copyItems: ExportCopyItem[];

	/** Describes what the export takes, shown at the top of the menu */
	description?: string;

	downloadItems: ExportDownloadItem[];

	/** Prefixes the ids that label the menu's groups */
	id: string;

	/** The section of the account settings the Settings link opens */
	settingsHash: string;

	trigger: ReactNode;
};

/**
 * Tracks whether an export was just copied, and copies text to the clipboard.
 *
 * `tag` names the export in the Sentry report of a failed write.
 */
export function useCopyExport(tag: string) {
	const [copied, setCopied] = useState(false);

	useTimedReset(copied, () => setCopied(false));

	// Only a resolved write flips the label, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the export was copied.
	function copy(text: string) {
		writeToClipboard(text).then(
			() => setCopied(true),
			(error) =>
				Sentry.captureException(error, {
					tags: { clipboard: tag },
				}),
		);
	}

	return { copied, copy };
}

/**
 * The shell of an export menu: Copy and Download groups, the caller's options,
 * and a link to the account settings.
 */
export default function ExportMenu({
	children,
	copyItems,
	description,
	downloadItems,
	id,
	settingsHash,
	trigger,
}: ExportMenuProps) {
	const isSecureContext = useIsSecureContext();

	return (
		<Dropdown>
			{trigger}
			{/* Opens leftward: the trigger sits at the end of its toolbar, so a menu
			    aligned to its start edge runs into the scrollbar. */}
			<DropdownMenuContent align="end">
				{description && (
					<>
						<p className="mb-0 px-2 py-1.5 text-xs text-gray-500">
							{description}
						</p>
						<DropdownMenuSeparator />
					</>
				)}
				{/* The clipboard API is unavailable outside a secure context. */}
				{isSecureContext && (
					<>
						<DropdownMenuGroup aria-labelledby={`${id}Copy`}>
							<DropdownMenuLabel id={`${id}Copy`}>Copy</DropdownMenuLabel>
							{copyItems.map((item) => (
								<DropdownMenuItem
									disabled={item.disabled}
									key={item.label}
									onSelect={item.onSelect}
								>
									<Icon icon={ClipboardCopy} /> {item.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup aria-labelledby={`${id}Download`}>
					<DropdownMenuLabel id={`${id}Download`}>Download</DropdownMenuLabel>
					{downloadItems.map((item) =>
						"href" in item ? (
							<DropdownMenuDownload href={item.href} key={item.label}>
								<Icon icon={item.icon} /> {item.label}
							</DropdownMenuDownload>
						) : (
							<DropdownMenuItem
								disabled={item.disabled}
								key={item.label}
								onSelect={item.onSelect}
							>
								<Icon icon={item.icon} /> {item.label}
							</DropdownMenuItem>
						),
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{children}
				<DropdownMenuSeparator />
				<DropdownMenuLink hash={settingsHash} to="/account/settings">
					<Icon icon={Settings} /> Settings
				</DropdownMenuLink>
			</DropdownMenuContent>
		</Dropdown>
	);
}
