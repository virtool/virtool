import Button, { type ButtonProps } from "@base/Button";
import { DropdownMenu } from "radix-ui";

/**
 * Props for a dropdown's trigger.
 *
 * Everything `Button` accepts flows through the rest spread, so a `Tooltip`
 * wrapping the trigger can hand its behaviour down. `as` is fixed — being the
 * menu's trigger is what makes this a dropdown button.
 */
type DropdownButtonProps = Omit<ButtonProps, "as">;

export default function DropdownButton(props: DropdownButtonProps) {
	return <Button as={DropdownMenu.Trigger} {...props} />;
}
