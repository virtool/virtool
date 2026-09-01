import { useUpdateSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InputGroup, InputLabel } from "@base/Input";
import SectionHeader from "@base/SectionHeader";
import { SelectBox, SelectBoxItem } from "@base/Select";
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
					<SelectBox
						className="grid-cols-3"
						label="Sample Group"
						onValueChange={(value) => mutation.mutate({ sampleGroup: value })}
						value={sampleGroup}
					>
						<SelectBoxItem value="none">
							<strong>None</strong>
							<p>
								Samples are assigned no group and only
								<em> all {"users'"}</em> rights apply
							</p>
						</SelectBoxItem>
						<SelectBoxItem value="force_choice">
							<strong>Force choice</strong>
							<p>
								Samples are automatically assigned the creating
								{"user's"} primary group
							</p>
						</SelectBoxItem>
						<SelectBoxItem value="users_primary_group">
							<strong>{"User's"} primary group</strong>
							<p>Samples are assigned by the user in the creation form</p>
						</SelectBoxItem>
					</SelectBox>

					<InputGroup>
						<InputLabel htmlFor="group">Group Rights</InputLabel>
						<RightsSelect
							id="group"
							value={group}
							onChange={(value) =>
								mutation.mutate({
									sampleGroupRead: value.includes("r"),
									sampleGroupWrite: value.includes("w"),
								})
							}
						/>
					</InputGroup>

					<InputGroup>
						<InputLabel htmlFor="all">All {"Users'"} Rights</InputLabel>
						<RightsSelect
							id="all"
							value={all}
							onChange={(value) =>
								mutation.mutate({
									sampleAllRead: value.includes("r"),
									sampleAllWrite: value.includes("w"),
								})
							}
						/>
					</InputGroup>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
