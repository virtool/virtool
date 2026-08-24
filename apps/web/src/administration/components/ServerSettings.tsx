import { ContainerNarrow } from "@base/Container";
import Banners from "./Banners";
import NcbiApiKey from "./NcbiApiKey";

export default function ServerSettings() {
	return (
		<ContainerNarrow>
			<Banners />
			<NcbiApiKey />
		</ContainerNarrow>
	);
}
