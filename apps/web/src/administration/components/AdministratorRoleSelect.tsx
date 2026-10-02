import type { AdministratorRole } from "@administration/types";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import type { AdministratorRoleName } from "@virtool/contracts";
import { ChevronDown } from "lucide-react";

type RoleSelectProps = {
	className?: string;
	onChange: (value: AdministratorRoleName) => void;
	roles: AdministratorRole[];
	value?: AdministratorRoleName;
};

export default function AdministratorRoleSelect({
	className,
	onChange,
	roles,
	value,
}: RoleSelectProps) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectButton
				className={className}
				icon={ChevronDown}
				placeholder="Select administrator role"
			/>
			<SelectContent>
				{roles.map((role) => (
					<SelectItem
						value={role.id}
						key={role.id}
						description={role.description}
					>
						{`${role.id} Administrator`}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
