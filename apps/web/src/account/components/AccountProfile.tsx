import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InitialIcon } from "@base/Icon";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { ADMINISTRATOR_ROLES } from "@virtool/contracts";
import { ShieldUser } from "lucide-react";
import { useFetchAccount } from "../account";
import AccountHandle from "./AccountHandle";

/** Displays the account's identity with an option to change the handle. */
export default function AccountProfile() {
	const { data, isPending, isError } = useFetchAccount();

	if (isError && !data) {
		return <QueryError noun="your account" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const { administratorRole, groups, handle } = data;
	const role = ADMINISTRATOR_ROLES.find(({ id }) => id === administratorRole);

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Profile</h2>
				<p>Your handle, administrator role, and groups.</p>
			</SectionHeader>
			<div className="flex font-medium items-center gap-4 text-2xl">
				<InitialIcon handle={handle} size="xxl" />
				<span>{handle}</span>
			</div>
			<AccountHandle handle={handle} />
			<section>
				<SectionHeader level={3}>
					<h3>Administrator role</h3>
					<p>The parts of Virtool you can administer.</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						{role ? (
							<div className="flex items-center gap-3">
								<Label color="purple">
									<ShieldUser size={16} />
									{role.name} Administrator
								</Label>
								<span className="text-gray-600">{role.description}</span>
							</div>
						) : (
							<span className="text-gray-600">
								You are not an administrator.
							</span>
						)}
					</BoxGroupSection>
				</BoxGroup>
			</section>
			<section>
				<SectionHeader level={3}>
					<h3>Groups</h3>
					<p>The groups you belong to.</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection className="flex flex-wrap gap-2">
						{groups.length ? (
							groups
								.toSorted((a, b) => a.name.localeCompare(b.name))
								.map(({ id, name }) => <Label key={id}>{name}</Label>)
						) : (
							<span className="text-gray-600">
								You do not belong to any groups.
							</span>
						)}
					</BoxGroupSection>
				</BoxGroup>
			</section>
		</section>
	);
}
