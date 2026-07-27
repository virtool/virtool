type NuVsValuesProps = {
	e: number | null;
	orfCount: number;
};

/**
 * Displays the values associated with the Nuvs
 */
export default function NuvsValues({ e, orfCount }: NuVsValuesProps) {
	return (
		<span className="pt-1">
			<span className="text-rose-700">{orfCount} ORFs</span>
			<span> / </span>
			<span className="text-emerald-700">E = {e}</span>
		</span>
	);
}
