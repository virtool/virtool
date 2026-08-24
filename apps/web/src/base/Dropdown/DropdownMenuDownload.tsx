import type { ReactNode } from "react";
import DropdownMenuItem from "./DropdownMenuItem";

type DropdownMenuDownloadProps = {
	children: ReactNode;
	className?: string;
	href: string;
};

export default function DropdownMenuDownload({
	children,
	className,
	href,
}: DropdownMenuDownloadProps) {
	return (
		<DropdownMenuItem asChild className={className}>
			<a href={href} download>
				{children}
			</a>
		</DropdownMenuItem>
	);
}
