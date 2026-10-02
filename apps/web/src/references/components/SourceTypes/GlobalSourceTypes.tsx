import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { IconButton } from "@base/Icon";
import Input from "@base/Input";
import SectionHeader from "@base/SectionHeader";
import Toolbar from "@base/Toolbar";
import { useUpdateDefaultSourceTypes } from "@references/queries";
import { Undo2 } from "lucide-react";
import SourceTypeList from "./SourceTypeList";
import useSourceTypeEditor from "./useSourceTypeEditor";

type GlobalSourceTypesProps = {
	sourceTypes: string[];
};

export function GlobalSourceTypes({ sourceTypes }: GlobalSourceTypesProps) {
	const { mutate } = useUpdateDefaultSourceTypes();

	const {
		error,
		lastRemoved,
		handleRemove,
		handleSubmit,
		handleUndo,
		register,
	} = useSourceTypeEditor(sourceTypes, mutate);

	return (
		<section>
			<SectionHeader>
				<h2>Default Source Types</h2>
				<p>
					Configure a list of allowable source types that will be set
					automatically for new references.
				</p>
			</SectionHeader>
			<BoxGroup>
				<SourceTypeList sourceTypes={sourceTypes} onRemove={handleRemove} />

				{lastRemoved && (
					<BoxGroupSection className="bg-stone-100! flex! items-center justify-between!">
						<span>
							The source type{" "}
							<strong className="capitalize">{lastRemoved}</strong> was just
							removed.
						</span>
						<IconButton IconComponent={Undo2} tip="undo" onClick={handleUndo} />
					</BoxGroupSection>
				)}

				<BoxGroupSection>
					<form onSubmit={handleSubmit}>
						<Field className="mb-0 pb-0">
							<FieldLabel>Add Source Type</FieldLabel>
							<Toolbar>
								<div className="flex-grow">
									<Input {...register("sourceType")} />
								</div>
								<Button color="green" type="submit">
									Add
								</Button>
							</Toolbar>
							<FieldError>{error}</FieldError>
						</Field>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
