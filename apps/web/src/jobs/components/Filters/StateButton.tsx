import { cn } from "@app/cn";
import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";

type StateButtonProps = {
	/** Whether the state is selected */
	active: boolean;

	/** The number of jobs associated with the state */
	count: number;

	/** The name of the state */
	label: string;

	/** A callback function to handle the state selection */
	onClick: () => void;
};

/**
 * A condensed job state item for use in a list of job states
 */
export function StateButton({
	active,
	count,
	label,
	onClick,
}: StateButtonProps) {
	return (
		<BoxGroupSection
			className={cn(
				"bg-white",
				"capitalize",
				"flex",
				"gap-6",
				"items-center",
				"justify-between",
				"relative",
			)}
		>
			<Checkbox
				checked={active}
				id={`JobStateCheckbox-${label}`}
				label={label}
				onClick={onClick}
			/>
			<Badge className="ml-auto">{count}</Badge>
		</BoxGroupSection>
	);
}
