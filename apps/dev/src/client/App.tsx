import { Tabs } from "radix-ui";
import { useEffect, useState } from "react";
import type {
	Environment,
	Mutation,
	SchedulerState,
	ServiceState,
} from "../shared/types.ts";
import { useSnapshot } from "./store.ts";

const CONTROL =
	"cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-45";
const PRIMARY = `${CONTROL} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`;
const DANGER = `${CONTROL} border-red-200 text-red-800 hover:bg-red-50`;
const PANEL = "rounded-xl border border-slate-200 bg-white";
const TAB =
	"cursor-pointer border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:text-emerald-900 data-[state=active]:border-emerald-700 data-[state=active]:text-emerald-900";

async function post(path: string, body: unknown): Promise<void> {
	const response = await fetch(path, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(
			(await response.text()) || `Request failed (${response.status})`,
		);
	}
}

function useAction() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	async function run(
		action: () => Promise<void>,
		success: string,
	): Promise<void> {
		setPending(true);
		setError(null);
		setMessage(null);
		try {
			await action();
			setMessage(success);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setPending(false);
		}
	}
	return { pending, error, message, run };
}

function Feedback({
	error,
	message,
}: {
	error: string | null;
	message: string | null;
}) {
	return (
		<>
			{error && (
				<pre
					role="alert"
					className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-3 text-sm text-red-800"
				>
					{error}
				</pre>
			)}
			{message && (
				<p role="status" className="mt-2 text-sm text-slate-600">
					{message}
				</p>
			)}
		</>
	);
}

function Badge({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: "neutral" | "good" | "bad" | "busy";
}) {
	const colors = {
		neutral: "bg-slate-100 text-slate-600",
		good: "bg-emerald-50 text-emerald-800",
		bad: "bg-red-50 text-red-800",
		busy: "bg-amber-50 text-amber-900",
	};
	return (
		<span
			className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}
		>
			{label}
		</span>
	);
}

function Services({ services }: { services: Record<string, ServiceState> }) {
	return (
		<div className="flex flex-wrap gap-2">
			{Object.entries(services).map(([name, health]) => (
				<Badge
					key={name}
					label={`${name}: ${health}`}
					tone={
						health === "healthy"
							? "good"
							: health === "stopped"
								? "neutral"
								: "bad"
					}
				/>
			))}
		</div>
	);
}

function SharedServices({
	services,
}: {
	services: Record<string, ServiceState>;
}) {
	const entries = Object.entries(services);
	if (entries.length === 0) {
		return (
			<p className={`${PANEL} p-6 text-sm text-slate-500`}>
				No shared service health checks are available yet.
			</p>
		);
	}
	return (
		<section
			aria-label="Shared services"
			className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
		>
			{entries.map(([name, health]) => (
				<article
					aria-label={`${name} service`}
					className={`${PANEL} flex items-center justify-between gap-3 p-4`}
					key={name}
				>
					<h3 className="font-semibold text-emerald-950">{name}</h3>
					<Badge
						label={health}
						tone={
							health === "healthy"
								? "good"
								: health === "stopped"
									? "neutral"
									: "bad"
						}
					/>
				</article>
			))}
		</section>
	);
}

function formatBytes(bytes: number | null): string {
	if (bytes === null) {
		return "Unavailable";
	}
	if (bytes < 1_000) {
		return `${bytes} B`;
	}
	const units = ["kB", "MB", "GB", "TB"];
	let value = bytes;
	let unit = "B";
	for (const next of units) {
		if (value < 1_000) {
			break;
		}
		value /= 1_000;
		unit = next;
	}
	return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function SharedStorage({
	storage,
}: {
	storage: { azurite: number | null; postgres: number | null };
}) {
	return (
		<section aria-label="Shared storage" className="grid gap-3 sm:grid-cols-2">
			{(["postgres", "azurite"] as const).map((name) => (
				<article className={`${PANEL} p-4`} key={name}>
					<div className="flex items-center justify-between gap-3">
						<h3 className="font-semibold text-emerald-950">{name}</h3>
						<span className="text-sm font-medium text-slate-600">
							{formatBytes(storage[name])}
						</span>
					</div>
					<p className="mt-1 text-xs text-slate-500">Volume usage</p>
				</article>
			))}
		</section>
	);
}

function isBusy(environment: Environment): boolean {
	return (
		environment.operation?.status === "running" ||
		environment.operation?.status === "pending" ||
		["starting", "stopping", "removing"].includes(environment.observed)
	);
}

function EnvironmentRow({
	environment,
	scheduler,
	connected,
	selected,
	onSelect,
}: {
	environment: Environment;
	scheduler: SchedulerState;
	connected: boolean;
	selected: boolean;
	onSelect: (selected: boolean) => void;
}) {
	const action = useAction();
	const busy = isBusy(environment);
	const disabled = !connected || busy || action.pending;
	const failed =
		environment.observed === "failed" ||
		environment.observed === "missing" ||
		Boolean(environment.lastError);
	const running = environment.observed === "running";
	const primary =
		failed && environment.id ? "retry" : running ? "stop" : "start";
	const active = scheduler.active.filter(
		(item) => item.environmentId === environment.id,
	).length;
	const queued = Object.values(
		scheduler.queues[environment.id ?? ""] ?? {},
	).reduce((total, count) => total + (count ?? 0), 0);
	async function act(value: Mutation["action"]): Promise<void> {
		if (
			value === "remove" &&
			!window.confirm(
				`Delete the database, stored files, and containers for ${environment.branch}? The Git worktree will be kept.`,
			)
		) {
			return;
		}
		await action.run(
			() =>
				post("/api/environments", {
					action: value,
					worktreeIds: [environment.worktreeId],
				}),
			"Request accepted.",
		);
	}
	return (
		<article className={`${PANEL} p-4`}>
			<div className="flex flex-wrap items-center gap-3">
				<input
					aria-label={`Select ${environment.branch}`}
					type="checkbox"
					checked={selected}
					onChange={(event) => onSelect(event.target.checked)}
					disabled={!environment.id || disabled}
					className="size-4 accent-emerald-700"
				/>
				<h2 className="min-w-0 flex-1 break-all font-semibold text-emerald-950">
					{environment.branch}
				</h2>
				<Badge
					label={
						busy
							? environment.operation?.action === "start"
								? "Starting"
								: environment.observed.replaceAll("_", " ")
							: environment.ready
								? "Ready"
								: environment.observed.replaceAll("_", " ")
					}
					tone={
						busy
							? "busy"
							: failed
								? "bad"
								: environment.ready
									? "good"
									: "neutral"
					}
				/>
				{environment.openPullRequest ? (
					<a
						className="text-xs font-semibold text-blue-700 hover:underline"
						href={environment.openPullRequest.url}
						target="_blank"
						rel="noreferrer"
					>
						Open PR #{environment.openPullRequest.number} ↗
					</a>
				) : (
					<span className="text-xs text-slate-400">No open PR</span>
				)}
				<div className="flex gap-2">
					{environment.ready && environment.url && (
						<a
							className={PRIMARY}
							href={environment.url}
							target="_blank"
							rel="noreferrer"
						>
							Open app ↗
						</a>
					)}
					<button
						className={environment.ready ? CONTROL : PRIMARY}
						disabled={disabled}
						type="button"
						onClick={() => void act(primary)}
					>
						{action.pending
							? "Sending…"
							: busy
								? "Working…"
								: primary === "retry"
									? "Retry"
									: primary === "stop"
										? "Stop"
										: "Start"}
					</button>
				</div>
			</div>
			{busy && (
				<p role="status" className="mt-2 text-sm text-amber-900">
					{environment.operation?.progress || "Waiting for environment state…"}
				</p>
			)}
			<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
				<span>
					{active} workflows running · {queued} queued
				</span>
				{!environment.workflowEnabled && <span>Workflows paused</span>}
			</div>
			<Feedback
				error={action.error ?? environment.lastError}
				message={action.message}
			/>
			<details className="mt-3 text-sm">
				<summary className="w-fit cursor-pointer text-slate-600">
					Environment details
				</summary>
				<div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
					<code className="block break-all text-xs text-slate-500">
						{environment.path}
					</code>
					<div className="flex flex-wrap gap-4 text-xs text-slate-500">
						<span>Desired state: {environment.desired}</span>
						{environment.age !== null && (
							<time dateTime={new Date(environment.age).toISOString()}>
								Created {new Date(environment.age).toISOString()}
							</time>
						)}
					</div>
					<Services services={environment.services} />
					<div className="flex flex-wrap gap-2">
						<button
							className={CONTROL}
							disabled={disabled || !environment.id}
							type="button"
							onClick={() => void act("restart")}
						>
							Restart
						</button>
						<button
							className={CONTROL}
							disabled={disabled || !environment.id}
							type="button"
							onClick={() =>
								void act(
									environment.workflowEnabled
										? "disable_workflows"
										: "enable_workflows",
								)
							}
						>
							{environment.workflowEnabled
								? "Pause workflows"
								: "Enable workflows"}
						</button>
						<button
							className={DANGER}
							disabled={disabled || !environment.id}
							type="button"
							onClick={() => void act("remove")}
						>
							Delete environment data
						</button>
					</div>
				</div>
			</details>
		</article>
	);
}

function Scheduler({
	state,
	connected,
}: {
	state: SchedulerState;
	connected: boolean;
}) {
	const [draft, setDraft] = useState<number | null>(null);
	const concurrency = draft ?? state.concurrency;
	const action = useAction();
	const pending = Object.values(state.queues).reduce(
		(total, queue) =>
			total +
			Object.values(queue).reduce((sum, count) => sum + (count ?? 0), 0),
		0,
	);
	return (
		<details className={`${PANEL} p-4`}>
			<summary className="cursor-pointer text-sm font-semibold">
				Workflow scheduler · {pending} queued · {state.active.length}/
				{state.concurrency} running
			</summary>
			<Feedback
				error={action.error ?? state.lastError}
				message={action.message}
			/>
			<div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
				<label className="grid gap-1 font-medium">
					Global concurrency
					<input
						className="w-24 rounded-lg border border-slate-200 px-3 py-1.5"
						max={32}
						min={1}
						type="number"
						value={Number.isNaN(concurrency) ? "" : concurrency}
						onChange={(event) => setDraft(event.target.valueAsNumber)}
					/>
				</label>
				<button
					className={CONTROL}
					disabled={
						!connected ||
						action.pending ||
						!Number.isInteger(concurrency) ||
						concurrency < 1 ||
						concurrency > 32 ||
						concurrency === state.concurrency
					}
					type="button"
					onClick={() =>
						void action.run(async () => {
							await post("/api/scheduler", { concurrency });
							setDraft(null);
						}, "Concurrency saved.")
					}
				>
					{action.pending ? "Saving…" : "Save"}
				</button>
				<span>{state.capacity} slots available</span>
				{state.buildQueue.map((build) => (
					<span key={`${build.environmentId}-${build.workflow}`}>
						Building {build.workflow}
					</span>
				))}
			</div>
		</details>
	);
}

function DaemonLog() {
	const [logs, setLogs] = useState("");
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		async function refresh(): Promise<void> {
			try {
				const response = await fetch("/api/logs");
				if (!response.ok) {
					throw new Error("Unable to load daemon logs.");
				}
				const text = await response.text();
				if (active) {
					setLogs(text);
					setError(null);
				}
			} catch {
				if (active) {
					setError("Unable to load daemon logs.");
				}
			}
		}
		void refresh();
		const timer = setInterval(() => void refresh(), 2_000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, []);
	return (
		<section aria-label="Daemon log" className={`${PANEL} p-4`}>
			<h2 className="text-sm font-semibold">Daemon log</h2>
			<Feedback error={error} message={null} />
			<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
				{logs || "No log output"}
			</pre>
		</section>
	);
}

export default function App() {
	const { snapshot, connection } = useSnapshot();
	const connected = connection === "live";
	const [selected, setSelected] = useState<string[]>([]);
	const action = useAction();
	const selectedIds = snapshot.environments
		.filter(
			(environment) =>
				selected.includes(environment.worktreeId) &&
				environment.id &&
				!isBusy(environment),
		)
		.map((environment) => environment.worktreeId);
	async function bulk(value: "remove" | "stop"): Promise<void> {
		if (
			!selectedIds.length ||
			(value === "remove" &&
				!window.confirm(
					`Delete the databases, stored files, and containers for ${selectedIds.length} environments? Git worktrees will be kept.`,
				))
		) {
			return;
		}
		await action.run(async () => {
			await post("/api/environments", {
				action: value,
				worktreeIds: selectedIds,
			});
			setSelected([]);
		}, "Request accepted.");
	}
	async function resetShared(): Promise<void> {
		if (
			!window.confirm(
				"Reset shared Postgres, Azurite, and HTTPS data for every environment?",
			)
		) {
			return;
		}
		await action.run(
			() => post("/api/shared/reset", { confirmation: "reset" }),
			"Shared data reset completed.",
		);
	}
	const sharedProblems =
		Boolean(snapshot.shared.lastError) ||
		Object.values(snapshot.shared.services).some(
			(state) => state !== "healthy",
		);
	const sharedStorage = snapshot.shared.storage ?? {
		azurite: null,
		postgres: null,
	};
	return (
		<main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-8">
			<header className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-700">
						Virtool dev
					</p>
					<h1 className="text-2xl font-bold tracking-tight text-emerald-950">
						Development environments
					</h1>
				</div>
				<div role="status">
					<Badge
						label={
							connected
								? "Live"
								: connection === "connecting"
									? "Connecting…"
									: "Reconnecting…"
						}
						tone={connected ? "good" : "busy"}
					/>
				</div>
			</header>
			{!connected && (
				<p
					role="status"
					className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
				>
					{snapshot.updatedAt
						? "Connection interrupted. Showing the last received state; controls will return when reconnected."
						: "Connecting to the daemon to load environments…"}
				</p>
			)}
			{snapshot.updateAvailable && (
				<p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
					An updated daemon is ready and will restart when operations finish.
				</p>
			)}
			<Tabs.Root defaultValue="worktrees">
				<Tabs.List
					aria-label="Development environment sections"
					className="mb-5 flex border-b border-slate-200"
				>
					<Tabs.Trigger className={TAB} value="worktrees">
						Worktrees
					</Tabs.Trigger>
					<Tabs.Trigger className={TAB} value="shared">
						Shared
					</Tabs.Trigger>
					<Tabs.Trigger className={TAB} value="workflows">
						Workflows
					</Tabs.Trigger>
					<Tabs.Trigger className={TAB} value="daemon-log">
						Daemon log
					</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="worktrees">
					<div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
						<h2 className="mr-auto font-semibold">
							{snapshot.environments.length} worktrees
						</h2>
						{selectedIds.length > 0 && (
							<>
								<span>{selectedIds.length} selected</span>
								<button
									className={CONTROL}
									disabled={!connected || action.pending}
									type="button"
									onClick={() => void bulk("stop")}
								>
									Stop selected
								</button>
								<button
									className={DANGER}
									disabled={!connected || action.pending}
									type="button"
									onClick={() => void bulk("remove")}
								>
									Delete selected data
								</button>
							</>
						)}
					</div>
					<Feedback
						error={action.error}
						message={action.pending ? "Sending request…" : action.message}
					/>
					<section aria-label="Environments" className="mt-3 grid gap-3">
						{connected && snapshot.environments.length === 0 && (
							<p className={`${PANEL} p-6 text-sm text-slate-500`}>
								No Git worktrees found. Worktrees appear here automatically when
								discovered.
							</p>
						)}
						{snapshot.environments.map((environment) => (
							<EnvironmentRow
								key={environment.worktreeId}
								environment={environment}
								scheduler={snapshot.scheduler}
								connected={connected}
								selected={selectedIds.includes(environment.worktreeId)}
								onSelect={(checked) =>
									setSelected(
										checked
											? [...selectedIds, environment.worktreeId]
											: selectedIds.filter(
													(id) => id !== environment.worktreeId,
												),
									)
								}
							/>
						))}
					</section>
				</Tabs.Content>
				<Tabs.Content className="grid gap-3" value="shared">
					<section aria-label="Shared infrastructure">
						<div className="mb-3 flex flex-wrap items-center gap-3">
							<h2 className="text-sm font-semibold">Shared infrastructure</h2>
							<Badge
								label={
									sharedProblems
										? "Needs attention"
										: !snapshot.shared.initialized
											? "Not started"
											: Object.keys(snapshot.shared.services).length
												? "Healthy"
												: "Awaiting health checks"
								}
								tone={
									sharedProblems
										? "bad"
										: snapshot.shared.initialized &&
												Object.keys(snapshot.shared.services).length
											? "good"
											: "neutral"
								}
							/>
						</div>
						<SharedServices services={snapshot.shared.services} />
						<div className="mt-3">
							<SharedStorage storage={sharedStorage} />
						</div>
						<Feedback error={snapshot.shared.lastError} message={null} />
						<details className="mt-3 text-xs text-slate-500">
							<summary className="w-fit cursor-pointer">
								Infrastructure settings
							</summary>
							<p className="my-3">
								Reset deletes shared database, object storage, and HTTPS data
								for every environment.
							</p>
							<button
								className={DANGER}
								type="button"
								disabled={!connected || action.pending}
								onClick={() => void resetShared()}
							>
								Reset shared data
							</button>
						</details>
					</section>
				</Tabs.Content>
				<Tabs.Content value="workflows">
					<Scheduler state={snapshot.scheduler} connected={connected} />
				</Tabs.Content>
				<Tabs.Content value="daemon-log">
					<DaemonLog />
				</Tabs.Content>
			</Tabs.Root>
		</main>
	);
}
