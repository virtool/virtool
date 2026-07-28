type IndexItemDescriptionProps = {
	changeCount: number;
	modifiedCount: number;
};

/**
 * Description of changes made since the last index build
 *
 * @param changeCount - The number of changes made since the last index build
 * @param modifiedCount - The number of OTUs modified since the last index build
 * @returns The index item's description
 */
export function IndexItemDescription({
	changeCount,
	modifiedCount,
}: IndexItemDescriptionProps) {
	if (changeCount === 0) {
		return <>No changes</>;
	}

	return (
		<span>
			{changeCount} change{changeCount === 1 ? "" : "s"} made in {modifiedCount}{" "}
			OTU
			{modifiedCount === 1 ? "" : "s"}
		</span>
	);
}
