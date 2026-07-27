import { getErrorStatus } from "@app/queryErrors";
import Icon from "@base/Icon";
import IconButton from "@base/IconButton";
import NavTab from "@base/NavTab";
import NavTabs from "@base/NavTabs";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderAttribution from "@base/ViewHeaderAttribution";
import ViewHeaderIcons from "@base/ViewHeaderIcons";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { JobNestedSchema } from "@jobs/types";
import DeleteSample from "@samples/components/Detail/DeleteSample";
import EditSample from "@samples/components/EditSample";
import { useCheckCanEditSample } from "@samples/hooks";
import { useSuspenseSample } from "@samples/queries";
import { toServerJobNested } from "@samples/utils";
import {
	createFileRoute,
	notFound,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { Key, Pencil } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/samples/$sampleId")({
	loader: async ({ context: { queryClient }, params: { sampleId } }) => {
		// Sample ids are integers. A nonnumeric param — e.g. a stale link from a
		// pre-migration job that recorded a legacy string sample id — can no
		// longer resolve, so treat it as not-found rather than requesting
		// `/api/samples/NaN`.
		const numericSampleId = Number(sampleId);
		if (!Number.isInteger(numericSampleId)) {
			throw notFound();
		}

		const { sampleQueryOptions } = await import("@samples/queries");

		try {
			await queryClient.ensureQueryData(sampleQueryOptions(numericSampleId));
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: SampleDetailLayout,
});

function SampleDetailLayout() {
	const { sampleId } = Route.useParams();
	const numericSampleId = Number(sampleId);
	const location = useLocation();
	const { data } = useSuspenseSample(numericSampleId);
	const { hasPermission: canModify } = useCheckCanEditSample(numericSampleId);
	const [editOpen, setEditOpen] = useState(false);

	const { createdAt, name, user } = data;
	const job = data.job && JobNestedSchema.parse(toServerJobNested(data.job));

	return (
		<>
			<ViewHeader title={name}>
				<ViewHeaderTitle>
					{name}
					<ViewHeaderIcons>
						{canModify && location.pathname.endsWith("/general") && (
							<>
								<IconButton
									color="gray"
									IconComponent={Pencil}
									tip="modify"
									onClick={() => setEditOpen(true)}
								/>
								<DeleteSample
									id={numericSampleId}
									name={data.name}
									ready={data.ready}
									job={job}
								/>
							</>
						)}
					</ViewHeaderIcons>
				</ViewHeaderTitle>
				<ViewHeaderAttribution time={createdAt} user={user.handle} />
			</ViewHeader>

			<NavTabs>
				<NavTab to={`/samples/${sampleId}/general`}>General</NavTab>
				{data.ready && (
					<>
						<NavTab to={`/samples/${sampleId}/files`}>Files</NavTab>
						<NavTab to={`/samples/${sampleId}/quality`}>Quality</NavTab>
						<NavTab to={`/samples/${sampleId}/analyses`}>Analyses</NavTab>
						{canModify && (
							<NavTab to={`/samples/${sampleId}/rights`}>
								<Icon icon={Key} />
							</NavTab>
						)}
					</>
				)}
			</NavTabs>

			<Outlet />

			<EditSample open={editOpen} sample={data} setOpen={setEditOpen} />
		</>
	);
}
