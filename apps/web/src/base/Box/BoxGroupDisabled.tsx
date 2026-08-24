import type { ReactNode } from "react";

type BoxGroupDisabledProps = {
	children: ReactNode;
	disabled?: boolean;
};

export default function BoxGroupDisabled({
	children,
	disabled = false,
}: BoxGroupDisabledProps) {
	return (
		<div className="relative">
			{disabled && (
				<div className="absolute inset-0 z-10 bg-gray-100 opacity-50" />
			)}
			{children}
		</div>
	);
}
