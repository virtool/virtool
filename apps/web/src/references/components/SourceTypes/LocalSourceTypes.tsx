import SettingsCheckbox from "@administration/components/SettingsCheckbox";
import { BoxGroup, BoxGroupDisabled, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import { IconButton } from "@base/Icon";
import { InputContainer, InputError, InputSimple } from "@base/Input";
import SectionHeader from "@base/SectionHeader";
import {
	useSuspenseReference,
	useUpdateReference,
	useUpdateReferenceSourceTypes,
} from "@references/queries";
import { getRouteApi } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import SourceTypeList from "./SourceTypeList";
import useSourceTypeEditor from "./useSourceTypeEditor";

const routeApi = getRouteApi("/_authenticated/refs/$refId");

export function LocalSourceTypes() {
	const { refId } = routeApi.useParams();
	const referenceId = Number(refId);

	const { data } = useSuspenseReference(referenceId);

	const { mutation: updateReferenceMutation } = useUpdateReference(referenceId);

	const sourceTypes = data.sourceTypes ?? [];
	const restrictSourceTypes = data.restrictSourceTypes ?? false;

	const { mutate } = useUpdateReferenceSourceTypes(referenceId);

	const {
		error,
		lastRemoved,
		handleRemove,
		handleSubmit,
		handleUndo,
		register,
	} = useSourceTypeEditor(sourceTypes, mutate);

	function handleToggle() {
		updateReferenceMutation.mutate({
			restrictSourceTypes: !restrictSourceTypes,
		});
	}

	return (
		<section>
			<SectionHeader>
				<h2>Source Types</h2>
				<p>Configure a list of allowable source types.</p>
			</SectionHeader>
			<SettingsCheckbox
				enabled={restrictSourceTypes}
				id="RestrictSourceTypes"
				onToggle={handleToggle}
			>
				<h2>Restrict Source Types</h2>
				<small>
					Only allow users to to select from allowed source types for isolates.
					If disabled, users will be able to enter any string as a source type.
				</small>
			</SettingsCheckbox>
			<BoxGroup>
				<BoxGroupDisabled disabled={!restrictSourceTypes}>
					<SourceTypeList sourceTypes={sourceTypes} onRemove={handleRemove} />
					{lastRemoved && (
						<BoxGroupSection className="flex items-center bg-gray-50">
							<span>
								The source type{" "}
								<strong className="capitalize">{lastRemoved}</strong> was just
								removed.
							</span>
							<IconButton
								className="ml-auto"
								IconComponent={Undo2}
								tip="undo"
								onClick={handleUndo}
							/>
						</BoxGroupSection>
					)}
					<BoxGroupSection>
						<form onSubmit={handleSubmit}>
							<label className="block mb-1" htmlFor="sourceType">
								Add Source Type{" "}
							</label>
							<InputContainer className="flex mb-1.5">
								<span className="flex flex-auto mr-2.5 flex-col">
									<InputSimple
										id="sourceType"
										aria-invalid={Boolean(error) || undefined}
										aria-describedby={error ? "sourceType-error" : undefined}
										{...register("sourceType")}
									/>
									<InputError id="sourceType-error">{error}</InputError>
								</span>
								<div
									className="ml-auto mr-1"
									style={{ width: "60px", height: "34px" }}
								>
									<Button
										className="w-full h-full text-center justify-center"
										color="green"
										type="submit"
									>
										Add
									</Button>
								</div>
							</InputContainer>
						</form>
					</BoxGroupSection>
				</BoxGroupDisabled>
			</BoxGroup>
		</section>
	);
}
