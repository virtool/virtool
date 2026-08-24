import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * Groups related menu items under `role="group"`. Pair with a
 * `DropdownMenuLabel` referenced by `aria-labelledby` so the section is
 * announced rather than only shown.
 */
export default function DropdownMenuGroup(
	props: ComponentPropsWithRef<typeof DropdownMenu.Group>,
) {
	return <DropdownMenu.Group {...props} />;
}
