import { useFetchAccount } from "@account/account";
import { ContainerNarrow } from "@base/Container";
import { hasSufficientAdminRole } from "@virtool/contracts";
import Banners from "./Banners";
import CacheStorageBudget from "./CacheStorageBudget";
import EmailDelivery from "./email/EmailDelivery";
import NcbiApiKey from "./NcbiApiKey";

export default function ServerSettings() {
	const { data: account } = useFetchAccount();

	const isFullAdministrator =
		account !== undefined &&
		hasSufficientAdminRole("full", account.administratorRole);

	return (
		<ContainerNarrow>
			<Banners />
			<NcbiApiKey />
			{isFullAdministrator ? <EmailDelivery /> : null}
			<CacheStorageBudget />
		</ContainerNarrow>
	);
}
