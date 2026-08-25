import { cn } from "@app/cn";
import PopoverContent from "@base/Popover/PopoverContent";
import { CloudUpload } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { useUploaderStore } from "../uploader";
import UploaderPanel from "./UploaderPanel";

/** How long the popover stays open after an upload starts, in milliseconds. */
const AUTO_DISMISS_MS = 4000;

/**
 * A nav-bar indicator showing aggregate upload progress.
 *
 * Its popover opens on its own when an upload starts and closes again after
 * {@link AUTO_DISMISS_MS}; clicking the indicator opens it until dismissed by
 * hand. Hovering the panel cancels the automatic dismissal.
 */
export default function UploadIndicator(): ReactElement | null {
	const uploads = useUploaderStore((state) => state.uploads);
	const remaining = useUploaderStore((state) => state.remaining);
	const speed = useUploaderStore((state) => state.speed);

	const [open, setOpen] = useState(false);
	const timeout = useRef<number>(undefined);
	const previousCount = useRef(0);

	function clearAutoDismiss() {
		window.clearTimeout(timeout.current);
	}

	useEffect(() => {
		if (uploads.length > previousCount.current) {
			setOpen(true);
			clearAutoDismiss();
			timeout.current = window.setTimeout(
				() => setOpen(false),
				AUTO_DISMISS_MS,
			);
		}

		previousCount.current = uploads.length;
	}, [uploads.length]);

	useEffect(() => clearAutoDismiss, []);

	if (uploads.length === 0) {
		return null;
	}

	function handleOpenChange(next: boolean) {
		// A trigger click, an outside press, or Escape is a deliberate choice, so
		// drop the automatic dismissal and honour it.
		clearAutoDismiss();
		setOpen(next);
	}

	const { loaded, total } = uploads.reduce(
		(acc, upload) => ({
			loaded: acc.loaded + upload.loaded,
			total: acc.total + upload.size,
		}),
		{ loaded: 0, total: 0 },
	);

	const percent = total === 0 ? 0 : Math.round((loaded / total) * 100);
	const failed = uploads.some((upload) => upload.failed);

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
			<PopoverPrimitive.Trigger asChild>
				<button
					type="button"
					aria-label="Uploads"
					className={cn(
						"flex gap-2 items-center rounded-md px-2 py-1 text-sm text-white",
						"hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
					)}
				>
					<CloudUpload
						size="1.2em"
						className={cn({ "text-red-300": failed })}
					/>
					<span className="font-medium tabular-nums">{percent}%</span>
				</button>
			</PopoverPrimitive.Trigger>
			<PopoverContent
				align="end"
				className="w-80 p-0"
				onMouseEnter={clearAutoDismiss}
			>
				<UploaderPanel
					onClose={() => handleOpenChange(false)}
					remaining={remaining}
					speed={speed}
					uploads={uploads}
				/>
			</PopoverContent>
		</PopoverPrimitive.Root>
	);
}
