type TableActionsHeadProps = {
	className?: string;

	/** What the column holds, named for assistive technology */
	label?: string;
};

/**
 * The header cell for a table's trailing column of row actions.
 *
 * The column carries no visible label, so it is named for assistive technology
 * rather than left an empty cell.
 */
export default function TableActionsHead({
	className,
	label = "Actions",
}: TableActionsHeadProps) {
	return (
		<th className={className} scope="col">
			<span className="sr-only">{label}</span>
		</th>
	);
}
