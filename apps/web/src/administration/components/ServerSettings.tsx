import { ContainerNarrow } from "@base/Container";
import Banners from "./Banners";
import CacheStorageBudget from "./CacheStorageBudget";
import NcbiApiKey from "./NcbiApiKey";

export default function ServerSettings() {
	return (
		<ContainerNarrow>
			<Banners />
			<NcbiApiKey />
			<CacheStorageBudget />
		</ContainerNarrow>
	);
}
