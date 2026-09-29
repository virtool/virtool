import { useUpdateSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@base/Field";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
import SectionHeader from "@base/SectionHeader";
import type { Settings } from "@virtool/contracts";
import RightsSelect from "./RightsSelect";

type SampleRightsProps = {
	/** The settings data used for configuring sample rights */
	settings: Settings;
};

/**
 * A component managing sample settings, allowing users to configure sample rights
 */
export default function SampleRights({ settings }: SampleRightsProps) {
	const mutation = useUpdateSettings();

	const {
		sampleGroup,
		sampleGroupRead,
		sampleGroupWrite,
		sampleAllRead,
		sampleAllWrite,
	} = settings;

	const group = (sampleGroupRead ? "r" : "") + (sampleGroupWrite ? "w" : "");
	const all = (sampleAllRead ? "r" : "") + (sampleAllWrite ? "w" : "");

	return (
		<section>
			<SectionHeader>
				<h2>Default Sample Rights</h2>
				<p>
					Set the method used to assign groups to new samples and the default
					rights.
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<FieldSet>
						<FieldLegend variant="label">Sample Group</FieldLegend>
						<RadioGroup
							className="grid-cols-3"
							onValueChange={(value) => mutation.mutate({ sampleGroup: value })}
							value={sampleGroup}
						>
							<FieldLabel variant="card">
								<Field orientation="horizontal" className="items-start">
									<RadioGroupItem className="mt-0.5" value="none" />
									<FieldContent>
										<FieldTitle>None</FieldTitle>
										<FieldDescription>
											Samples are assigned no group and only <em>all users’</em>{" "}
											rights apply.
										</FieldDescription>
									</FieldContent>
								</Field>
							</FieldLabel>
							<FieldLabel variant="card">
								<Field orientation="horizontal" className="items-start">
									<RadioGroupItem className="mt-0.5" value="force_choice" />
									<FieldContent>
										<FieldTitle>Force choice</FieldTitle>
										<FieldDescription>
											Samples are assigned by the user in the creation form.
										</FieldDescription>
									</FieldContent>
								</Field>
							</FieldLabel>
							<FieldLabel variant="card">
								<Field orientation="horizontal" className="items-start">
									<RadioGroupItem
										className="mt-0.5"
										value="users_primary_group"
									/>
									<FieldContent>
										<FieldTitle>User’s primary group</FieldTitle>
										<FieldDescription>
											Samples are automatically assigned the creating user’s
											primary group.
										</FieldDescription>
									</FieldContent>
								</Field>
							</FieldLabel>
						</RadioGroup>
					</FieldSet>

					<Field>
						<FieldLabel>Group Rights</FieldLabel>
						<RightsSelect
							value={group}
							onChange={(value) =>
								mutation.mutate({
									sampleGroupRead: value.includes("r"),
									sampleGroupWrite: value.includes("w"),
								})
							}
						/>
					</Field>

					<Field>
						<FieldLabel>All {"Users'"} Rights</FieldLabel>
						<RightsSelect
							value={all}
							onChange={(value) =>
								mutation.mutate({
									sampleAllRead: value.includes("r"),
									sampleAllWrite: value.includes("w"),
								})
							}
						/>
					</Field>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
