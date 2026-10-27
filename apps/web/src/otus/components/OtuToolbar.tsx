import Button from "@base/Button";
import SearchToolbar from "@base/SearchToolbar";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";

type OtuToolbarProps = {
	/** Current search term used for filtering */
	term: string;

	/** Update the search term in the url */
	setTerm: (term: string) => void;

	/** Called when the user clicks the Create button */
	onCreate: () => void;

	/** ID of the OTU's parent reference */
	referenceId: number;
};

/**
 * A toolbar which allows the OTUs to be filtered by their names
 */
export default function OtuToolbar({
	term,
	setTerm,
	onCreate,
	referenceId,
}: OtuToolbarProps) {
	const { hasPermission: canCreate } = useCheckReferenceRight(
		referenceId,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(referenceId);

	return (
		<SearchToolbar
			aria-label="Search OTUs"
			onChange={setTerm}
			placeholder="Name or acronym"
			value={term}
		>
			{canCreate && !archived && (
				<Button onClick={onCreate} color="blue">
					Create
				</Button>
			)}
		</SearchToolbar>
	);
}
