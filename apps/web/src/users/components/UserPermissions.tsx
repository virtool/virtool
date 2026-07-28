import { cn } from "@app/cn";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import type { Permissions } from "@virtool/contracts";
import { Check, X } from "lucide-react";

const permissionDescriptions: Record<keyof Permissions, string> = {
	cancel_job: "Cancel running jobs",
	create_ref: "Create new references",
	create_sample: "Create new samples",
	modify_hmm: "Install and manage HMM data",
	modify_subtraction: "Create and modify subtractions",
	remove_file: "Delete uploaded files",
	remove_job: "Delete job records",
	upload_file: "Upload files",
};

type UserPermissionsProps = {
	/** The users permissions */
	permissions: Permissions;
};

/**
 * A view of the users permissions
 */
export default function UserPermissions({ permissions }: UserPermissionsProps) {
	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<span className="font-medium">Permissions</span>
				<small className="font-medium text-gray-600">
					Change group membership to modify permissions
				</small>
			</div>
			<BoxGroup>
				{Object.entries(permissions).map(([permission, value]) => (
					<BoxGroupSection
						key={permission}
						aria-label={`${permission}:${value}`}
						className={cn("flex items-center", value && "bg-green-200")}
					>
						{value ? (
							<Check className="mr-4 text-green-600" size={20} />
						) : (
							<X className="mr-4 text-gray-600" size={20} />
						)}
						<div>
							<code>{permission}</code>
							<p className="m-0 text-sm text-gray-600">
								{permissionDescriptions[permission as keyof Permissions]}
							</p>
						</div>
					</BoxGroupSection>
				))}
			</BoxGroup>
		</div>
	);
}
