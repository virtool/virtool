export default function DevelopmentInstance() {
	if (
		!import.meta.env.DEV ||
		typeof __DEV_INSTANCE__ === "undefined" ||
		!__DEV_INSTANCE__
	) {
		return null;
	}

	return (
		<details className="fixed bottom-2 right-2 z-nav rounded border border-slate-300 bg-white p-2 text-xs text-slate-700 shadow">
			<summary className="cursor-pointer">{__DEV_INSTANCE__.branch}</summary>
			<div className="flex flex-col gap-1 pt-2">
				<span>{__DEV_INSTANCE__.name}</span>
				<span>{__DEV_INSTANCE__.worktree}</span>
				<a href="http://localhost:31415" target="_blank" rel="noreferrer">
					Open Coastguard
				</a>
			</div>
		</details>
	);
}
