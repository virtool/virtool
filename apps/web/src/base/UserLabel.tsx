import { cn } from "@app/cn";
import { InitialIcon } from "@base/Icon";

type UserLabelProps = {
	className?: string;

	/** The account's handle, which the label both draws and reads out */
	handle: string;
};

/**
 * A user's handle beside their initial icon, for a list or table cell that
 * names an account rather than attributing an action to one.
 *
 * The icon is decorative: the handle it draws is already the text beside it,
 * and `InitialIcon` labels itself with it.
 */
export default function UserLabel({ className, handle }: UserLabelProps) {
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<span aria-hidden>
				<InitialIcon size="md" handle={handle} />
			</span>
			{handle}
		</span>
	);
}
