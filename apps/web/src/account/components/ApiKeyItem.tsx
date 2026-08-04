import Attribution from "@base/Attribution";
import BoxGroupSection from "@base/BoxGroupSection";
import IconButton from "@base/IconButton";
import type { ApiKey } from "@virtool/contracts";
import { Trash } from "lucide-react";
import { useRemoveApiKey } from "../queries";
import ApiKeyEdit from "./ApiKeyEdit";

type ApiKeyItemProps = {
	apiKey: ApiKey;
};

/**
 * Display a condensed API key for use in a list of API keys
 */
export default function ApiKeyItem({ apiKey }: ApiKeyItemProps) {
	const permissionCount = Object.values(apiKey.permissions).reduce(
		(result, value) => result + (value ? 1 : 0),
		0,
	);

	const removeMutation = useRemoveApiKey();

	return (
		<BoxGroupSection>
			<h4 className="grid items-center grid-cols-4">
				<span className="font-medium text-lg">{apiKey.name}</span>
				<Attribution time={apiKey.createdAt} />
				<div className="text-right">
					{permissionCount} permission
					{permissionCount === 1 ? null : "s"}
				</div>
				<div className="flex justify-end">
					<ApiKeyEdit id={apiKey.id} permissions={apiKey.permissions} />
					<IconButton
						color="red"
						IconComponent={Trash}
						onClick={() => removeMutation.mutate({ keyId: apiKey.id })}
						tip="Delete"
					/>
				</div>
			</h4>
		</BoxGroupSection>
	);
}
