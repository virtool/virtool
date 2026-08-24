import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import Button from "@base/Button";
import SearchToolbar from "@base/SearchToolbar";
import { ToggleGroup, ToggleGroupItem } from "@base/Toggle";

type ReferenceToolbarProps = {
	archived: boolean;
	term: string;
	onCreate: () => void;
	setArchived: (archived: boolean) => void;
	setTerm: (term: string) => void;
};

/**
 * A toolbar which allows the references to be filtered by name and lifecycle
 */
export default function ReferenceToolbar({
	archived,
	term,
	onCreate,
	setArchived,
	setTerm,
}: ReferenceToolbarProps) {
	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_ref");

	return (
		<SearchToolbar
			aria-label="Search references"
			onChange={setTerm}
			placeholder="Reference name"
			value={term}
		>
			<ToggleGroup
				value={archived ? "archived" : "active"}
				onValueChange={(value) => setArchived(value === "archived")}
			>
				<ToggleGroupItem value="active">Active</ToggleGroupItem>
				<ToggleGroupItem value="archived">Archived</ToggleGroupItem>
			</ToggleGroup>
			{canCreate && (
				<Button color="blue" onClick={onCreate}>
					Create
				</Button>
			)}
		</SearchToolbar>
	);
}
