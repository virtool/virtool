import { BoxGroupSection } from "@base/Box";
import SampleLabel from "@samples/components/Label/SampleLabel";
import { Link } from "@tanstack/react-router";
import { DeleteLabel } from "./DeleteLabel";
import { EditLabel, type UpdatedLabel } from "./EditLabel";

type LabelItemProps = {
	color: string;
	description: string;
	id: number;
	name: string;
	onEdit: (id: number, values: UpdatedLabel) => Promise<unknown>;
	onDelete: (id: number) => Promise<unknown>;
};

/**
 * A condensed label item with edit and delete affordances.
 */
export function LabelItem({
	color,
	description,
	id,
	name,
	onEdit,
	onDelete,
}: LabelItemProps) {
	return (
		<BoxGroupSection className="flex items-center">
			<div className="min-w-3/10">
				<Link to="/samples" search={{ labels: [id] }}>
					<SampleLabel
						name={name}
						color={color}
						className="cursor-pointer hover:bg-gray-50"
					/>
				</Link>
			</div>
			{description}
			<div className="absolute top-0 right-0 bottom-0 flex items-center gap-1 pr-4 text-lg">
				<EditLabel
					color={color}
					description={description}
					name={name}
					onSubmit={(values) => onEdit(id, values)}
				/>
				<DeleteLabel name={name} onConfirm={() => onDelete(id)} />
			</div>
		</BoxGroupSection>
	);
}
