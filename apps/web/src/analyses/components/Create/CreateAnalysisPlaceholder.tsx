import Loader from "@base/Loader";

/**
 * Approximate the loaded form's height to limit dialog resizing during loading.
 */
export default function CreateAnalysisPlaceholder() {
	return (
		<div className="flex h-[23rem] items-center justify-center">
			<Loader />
		</div>
	);
}
