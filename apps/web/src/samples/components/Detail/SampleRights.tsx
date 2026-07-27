import { useFetchAccount } from "@account/account";
import { useCheckAdminRole } from "@administration/hooks";
import Box from "@base/Box";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import ContainerNarrow from "@base/ContainerNarrow";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import Select from "@base/Select";
import SelectButton from "@base/SelectButton";
import SelectContent from "@base/SelectContent";
import SelectItem from "@base/SelectItem";
import { useListGroups } from "@groups/queries";
import RightsSelect from "@samples/components/RightsSelect";
import { samplesQueryKeys } from "@samples/keys";
import { useFetchSample, useUpdateSampleRights } from "@samples/queries";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

/**
 * Stands in for an unset group. Radix reserves the empty string, so the absence
 * of a group can't be modelled by the item's value directly.
 */
const noGroup = "none";

type SampleRightsProps = {
	sampleId: number;
};

/**
 * A component managing a samples rights
 */
export default function SampleRights({ sampleId }: SampleRightsProps) {
	const { hasPermission } = useCheckAdminRole("full");
	const {
		data: sample,
		isPending: isPendingSample,
		isError: isErrorSample,
	} = useFetchSample(sampleId);
	const {
		data: account,
		isPending: isPendingAccount,
		isError: isErrorAccount,
	} = useFetchAccount();
	const {
		data: groups,
		isPending: isPendingGroups,
		isError: isErrorGroups,
	} = useListGroups();

	const queryClient = useQueryClient();
	const mutation = useUpdateSampleRights(sampleId);

	if (
		(isErrorSample && !sample) ||
		(isErrorAccount && !account) ||
		(isErrorGroups && !groups)
	) {
		return <QueryError noun="sample rights" />;
	}

	if (
		isPendingSample ||
		isPendingGroups ||
		isPendingAccount ||
		!sample ||
		!account ||
		!groups
	) {
		return <LoadingPlaceholder />;
	}

	const canModifyRights = hasPermission || sample.user.id === account.id;

	const { group, groupRead, groupWrite, allRead, allWrite } = sample;

	function handleChangeGroup(value: string) {
		const group = value === "" ? null : parseInt(value, 10);
		mutation.mutate(
			{ update: { group } },
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: samplesQueryKeys.detail(sampleId),
					});
				},
			},
		);
	}

	function handleChangeRights(value: string, scope: "all" | "group") {
		mutation.mutate(
			{
				update: {
					[`${scope}Read`]: value.includes("r"),
					[`${scope}Write`]: value.includes("w"),
				},
			},
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: samplesQueryKeys.detail(sampleId),
					});
				},
			},
		);
	}

	if (!canModifyRights) {
		return <Box>Not allowed</Box>;
	}

	const groupRights = (groupRead ? "r" : "") + (groupWrite ? "w" : "");
	const allRights = (allRead ? "r" : "") + (allWrite ? "w" : "");

	const selectedGroupId: string = group ? group.id.toString() : "";

	return (
		<ContainerNarrow>
			<BoxGroup>
				<BoxGroupHeader>
					<h2>Sample Rights</h2>
					<p>
						Control who can read and write this sample and which user group owns
						the sample.
					</p>
				</BoxGroupHeader>
				<BoxGroupSection>
					<InputGroup>
						<InputLabel htmlFor="group">Group</InputLabel>
						<Select
							value={selectedGroupId || noGroup}
							onValueChange={(value) =>
								handleChangeGroup(value === noGroup ? "" : value)
							}
						>
							<SelectButton className="w-full" icon={ChevronDown} id="group" />
							<SelectContent>
								<SelectItem key={noGroup} value={noGroup}>
									None
								</SelectItem>
								{groups.map((group) => (
									<SelectItem key={group.id} value={group.id.toString()}>
										{group.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</InputGroup>

					<InputGroup>
						<InputLabel htmlFor="groupRights">Group Rights</InputLabel>
						<RightsSelect
							id="groupRights"
							value={groupRights}
							onChange={(value) => handleChangeRights(value, "group")}
						/>
					</InputGroup>

					<InputGroup>
						<InputLabel htmlFor="allUsers">All {"Users'"} Rights</InputLabel>
						<RightsSelect
							id="allUsers"
							value={allRights}
							onChange={(value) => handleChangeRights(value, "all")}
						/>
					</InputGroup>
				</BoxGroupSection>
			</BoxGroup>
		</ContainerNarrow>
	);
}
