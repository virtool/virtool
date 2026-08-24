import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

export default function DropdownMenuRadioGroup(
	props: ComponentPropsWithRef<typeof DropdownMenu.RadioGroup>,
) {
	return <DropdownMenu.RadioGroup {...props} />;
}
