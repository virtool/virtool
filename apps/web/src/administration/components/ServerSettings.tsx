import ContainerNarrow from "@base/ContainerNarrow";
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
