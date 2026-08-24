import Badge from "@base/Badge";
import {
	ViewHeader,
	ViewHeaderAttribution,
	ViewHeaderIcons,
	ViewHeaderTitle,
} from "@base/View";
import { useCheckReferenceRight } from "@references/hooks";
import { useLocation } from "@tanstack/react-router";
import type { Reference } from "@virtool/contracts";
import ArchiveReference from "./ArchiveReference";
import EditReference from "./EditReference";

type ReferenceDetailHeaderProps = {
	createdAt: Date;
	/** The reference details */
	detail: Reference;
	name: string;
	userHandle: string;
};

/**
 * Header for a reference detail view. Archived references show an archived
 * badge and only the unarchive action; active references also expose editing.
 */
export default function ReferenceDetailHeader({
	createdAt,
	detail,
	name,
	userHandle,
}: ReferenceDetailHeaderProps) {
	const { pathname: location } = useLocation();
	const { hasPermission: canModify } = useCheckReferenceRight(
		detail.id,
		"modify",
	);

	const { archived } = detail;
	const showIcons = location.endsWith("/manage");

	return (
		<ViewHeader title={name}>
			<ViewHeaderTitle
				className={
					archived
						? "text-2xl font-semibold text-gray-700 leading-tight"
						: undefined
				}
			>
				{name}
				{archived && (
					<Badge className="ml-3" color="gray" variant="soft">
						Archived
					</Badge>
				)}
				{showIcons && canModify && (
					<ViewHeaderIcons>
						{!archived && <EditReference detail={detail} />}
						<ArchiveReference detail={detail} />
					</ViewHeaderIcons>
				)}
			</ViewHeaderTitle>
			<ViewHeaderAttribution time={createdAt} user={userHandle} />
		</ViewHeader>
	);
}
