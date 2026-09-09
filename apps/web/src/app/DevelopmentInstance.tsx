import { useEffect, useState } from "react";

type Instance = {
	name: string;
	branch: string;
	url: string;
	state: string;
};

export default function DevelopmentInstance() {
	if (
		!import.meta.env.DEV ||
		typeof __DEV_INSTANCE__ === "undefined" ||
		!__DEV_INSTANCE__
	) {
		return null;
	}

	return <InstanceSwitcher />;
}

function InstanceSwitcher() {
	const [instances, setInstances] = useState<Instance[]>([]);
	const [isUnavailable, setIsUnavailable] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(
		function discoverInstances() {
			if (!isOpen) {
				return;
			}
			const controller = new AbortController();
			async function refresh() {
				try {
					const response = await fetch("/__dev/instances", {
						signal: controller.signal,
					});
					if (!response.ok) {
						throw new Error("Discovery unavailable");
					}
					setInstances(await response.json());
					setIsUnavailable(false);
				} catch {
					if (!controller.signal.aborted) {
						setIsUnavailable(true);
					}
				}
			}
			void refresh();
			const interval = setInterval(refresh, 5000);
			return function stopDiscovery() {
				controller.abort();
				clearInterval(interval);
			};
		},
		[isOpen],
	);

	if (!__DEV_INSTANCE__) {
		return null;
	}

	return (
		<details
			className="fixed bottom-2 right-2 z-nav max-h-80 overflow-auto rounded border border-slate-300 bg-white p-2 text-xs text-slate-700 shadow"
			onToggle={function onToggle(event) {
				setIsOpen(event.currentTarget.open);
			}}
		>
			<summary className="cursor-pointer">{__DEV_INSTANCE__.branch}</summary>
			<div className="flex flex-col gap-1 pt-2">
				<span>{__DEV_INSTANCE__.name}</span>
				<span>{__DEV_INSTANCE__.worktree}</span>
				{isUnavailable ? (
					<span>
						Instance list unavailable. Run coast.py ensure to refresh.
					</span>
				) : (
					instances
						.filter(function other(instance) {
							return instance.name !== __DEV_INSTANCE__?.name;
						})
						.map(function link(instance) {
							return (
								<a
									key={instance.name}
									href={instance.url}
									target="_blank"
									rel="noreferrer"
								>
									{instance.branch} · {instance.name} ({instance.state})
								</a>
							);
						})
				)}
				<a href="http://localhost:31415" target="_blank" rel="noreferrer">
					Open Coastguard
				</a>
			</div>
		</details>
	);
}
