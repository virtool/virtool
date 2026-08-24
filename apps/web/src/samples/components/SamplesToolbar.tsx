import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import { buttonVariants } from "@base/Button";
import Link from "@base/Link";
import SearchToolbar from "@base/SearchToolbar";

type SampleToolbarProps = {
	onChange: (term: string) => void;

	term: string;
};

/**
 * A toolbar allowing samples to be filtered by name
 */
export default function SampleToolbar({ onChange, term }: SampleToolbarProps) {
	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_sample");

	return (
		<SearchToolbar
			aria-label="Search samples"
			onChange={onChange}
			placeholder="Sample name"
			value={term || ""}
		>
			{canCreate && (
				<Link
					className={buttonVariants({ color: "blue" })}
					to="/samples/create"
				>
					Create
				</Link>
			)}
		</SearchToolbar>
	);
}
