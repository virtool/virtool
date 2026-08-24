import Icon from "@base/Icon";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type SelectContentProps = {
	children: ReactNode;
};

export default function SelectContent({ children }: SelectContentProps) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				className="origin-top bg-white rounded-md border border-gray-300 shadow-md overflow-hidden z-dropdown max-h-96 min-w-32 data-[state=open]:animate-contentShow"
				data-slot="select-content"
			>
				<SelectPrimitive.ScrollUpButton className="my-1 flex justify-center hover:bg-gray-50">
					<Icon icon={ChevronUp} />
				</SelectPrimitive.ScrollUpButton>
				<SelectPrimitive.Viewport className="p-1">
					{children}
				</SelectPrimitive.Viewport>
				<SelectPrimitive.ScrollDownButton className="my-1 flex justify-center hover:bg-gray-50">
					<Icon icon={ChevronDown} />
				</SelectPrimitive.ScrollDownButton>
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}
