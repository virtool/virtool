import { useEffect, useState } from "react";
import type { Environment, Mutation, SchedulerState } from "../shared/types.ts";
import { useSnapshot } from "./store.ts";

async function mutate(mutation: Mutation): Promise<void> {
	const response = await fetch("/api/environments", {
		body: JSON.stringify(mutation),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(await response.text());
	}
}

function status(environment: Environment): string {
	if (
		environment.operation?.status === "running" ||
		environment.operation?.status === "pending"
	) {
		return `${environment.observed} · ${environment.operation.progress}`;
	}
	return environment.ready ? "ready" : environment.observed.replace("_", " ");
}

const CONTROL =
	"cursor-pointer rounded-lg border border-emerald-950/20 bg-slate-50 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:opacity-45";
const DANGER = `${CONTROL} border-red-200 text-red-800 hover:bg-red-50`;

function EnvironmentRow({ environment }: { environment: Environment }) {
	const [error, setError] = useState<string | null>(null);
	async function act(action: Mutation["action"]): Promise<void> {
		if (
			action === "remove" &&
			!window.confirm(`Remove ${environment.branch} and its development data?`)
		) {
			return;
		}
		try {
			setError(null);
			await mutate({ action, worktreeIds: [environment.worktreeId] });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}
	const statusColor = environment.ready
		? "bg-emerald-100 text-emerald-800"
		: environment.observed === "failed" || environment.observed === "missing"
			? "bg-red-100 text-red-800"
			: "bg-slate-100 text-slate-700";
	return (
		<article className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-[0_8px_30px_rgb(26_55_37/0.06)]">
			<div className="flex flex-col justify-between gap-3 sm:flex-row">
				<div>
					<h2 className="text-lg font-bold tracking-tight text-emerald-950">
						{environment.branch}
					</h2>
					<code className="break-all text-xs text-slate-500">
						{environment.path}
					</code>
				</div>
				<span
					className={`self-start rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}
				>
					{status(environment)}
				</span>
			</div>
			<div className="my-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
				<span>desired: {environment.desired}</span>
				{environment.url && (
					<a
						className="font-medium text-emerald-700 hover:text-emerald-900"
						href={environment.url}
					>
						{environment.url}
					</a>
				)}
				{environment.age && (
					<time dateTime={new Date(environment.age).toISOString()}>
						created {new Date(environment.age).toISOString()}
					</time>
				)}
			</div>
			{(error || environment.lastError) && (
				<pre className="mb-4 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-800">
					{error ?? environment.lastError}
				</pre>
			)}
			<div className="flex flex-wrap gap-2">
				<button
					className={CONTROL}
					type="button"
					onClick={() => void act("start")}
				>
					Start
				</button>
				<button
					className={CONTROL}
					type="button"
					onClick={() => void act("stop")}
					disabled={!environment.id}
				>
					Stop
				</button>
				<button
					className={CONTROL}
					type="button"
					onClick={() => void act("restart")}
					disabled={!environment.id}
				>
					Restart
				</button>
				<button
					className={CONTROL}
					type="button"
					onClick={() => void act("retry")}
					disabled={!environment.lastError}
				>
					Retry
				</button>
				<button
					className={CONTROL}
					type="button"
					onClick={() =>
						void act(
							environment.workflowEnabled
								? "disable_workflows"
								: "enable_workflows",
						)
					}
					disabled={!environment.id}
				>
					{environment.workflowEnabled ? "Pause workflows" : "Enable workflows"}
				</button>
				<button
					className={DANGER}
					type="button"
					onClick={() => void act("remove")}
					disabled={!environment.id}
				>
					Remove
				</button>
			</div>
			{Object.keys(environment.services).length > 0 && (
				<details className="mt-4 border-t border-emerald-950/10 pt-3 text-sm">
					<summary className="cursor-pointer font-semibold text-emerald-950">
						Services
					</summary>
					<div className="mt-2 grid gap-1 sm:grid-cols-3">
						{Object.entries(environment.services).map(
							([service, serviceState]) => (
								<div
									className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"
									key={service}
								>
									<span>{service}</span>
									<span className="font-medium text-slate-600">
										{serviceState}
									</span>
								</div>
							),
						)}
					</div>
				</details>
			)}
		</article>
	);
}

function Scheduler({ state }: { state: SchedulerState }) {
	const [concurrency, setConcurrency] = useState(state.concurrency);
	async function save(): Promise<void> {
		await fetch("/api/scheduler", {
			body: JSON.stringify({ concurrency }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
	}
	const pending = Object.values(state.queues).reduce(
		(total, queue) =>
			total +
			Object.values(queue).reduce((sum, count) => sum + (count ?? 0), 0),
		0,
	);
	return (
		<details className="mb-4 rounded-xl border border-emerald-950/10 bg-white p-4">
			<summary className="cursor-pointer font-bold text-emerald-950">
				Workflow scheduler · {pending} pending · {state.active.length} running
			</summary>
			<div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
				<label className="grid gap-1 font-medium">
					Global concurrency
					<input
						className="w-24 rounded-lg border border-emerald-950/20 px-3 py-1.5"
						max={32}
						min={1}
						type="number"
						value={concurrency}
						onChange={(event) => setConcurrency(event.target.valueAsNumber)}
					/>
				</label>
				<button className={CONTROL} type="button" onClick={() => void save()}>
					Save
				</button>
				<span>{state.capacity} slots available</span>
				{state.buildQueue.map((build) => (
					<span key={`${build.environmentId}-${build.workflow}`}>
						building {build.workflow}
					</span>
				))}
			</div>
		</details>
	);
}

function Logs() {
	const [logs, setLogs] = useState("");
	useEffect(() => {
		let active = true;
		async function refresh(): Promise<void> {
			const response = await fetch("/api/logs");
			if (active && response.ok) {
				setLogs(await response.text());
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
		<details className="mb-4 rounded-xl border border-emerald-950/10 bg-white p-4">
			<summary className="cursor-pointer font-bold text-emerald-950">
				Daemon log
			</summary>
			<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
				{logs || "No log output"}
			</pre>
		</details>
	);
}

export default function App() {
	const snapshot = useSnapshot();
	const [selected, setSelected] = useState<string[]>([]);
	async function bulk(action: "remove" | "stop"): Promise<void> {
		if (selected.length === 0) {
			return;
		}
		if (
			action === "remove" &&
			!window.confirm(`Remove ${selected.length} environments and their data?`)
		) {
			return;
		}
		await mutate({ action, worktreeIds: selected });
	}
	async function resetShared(): Promise<void> {
		if (
			!window.confirm(
				"Reset shared Postgres, Azurite, and HTTPS data for every environment?",
			)
		) {
			return;
		}
		await fetch("/api/shared/reset", {
			body: JSON.stringify({ confirmation: "reset" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
	}
	return (
		<main className="mx-auto max-w-6xl px-4 py-8 sm:px-7 sm:py-12">
			<header className="mb-8 flex flex-col items-stretch justify-between gap-6 sm:flex-row sm:items-end">
				<div>
					<p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
						Virtool
					</p>
					<h1 className="max-w-3xl text-4xl font-black tracking-[-0.055em] text-emerald-950 sm:text-6xl">
						Development environments
					</h1>
				</div>
				<div className="grid min-w-56 gap-1 rounded-xl bg-emerald-950 px-5 py-4 text-white shadow-lg shadow-emerald-950/10">
					<strong>Shared infrastructure</strong>
					<span className="text-sm text-emerald-200">
						{snapshot.shared.initialized ? "running" : "not started"}
					</span>
					<button
						className="mt-2 cursor-pointer justify-self-start text-xs font-semibold text-red-200 underline hover:text-white"
						type="button"
						onClick={() => void resetShared()}
					>
						Reset shared data
					</button>
				</div>
			</header>
			{snapshot.updateAvailable && (
				<div className="mb-4 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-amber-950">
					An updated daemon is ready and will restart when operations finish.
				</div>
			)}
			<section className="mb-4 flex flex-col items-stretch gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-sm sm:flex-row sm:items-center">
				<span>{snapshot.environments.length} worktrees</span>
				<span className="sm:mr-auto">
					{snapshot.scheduler.active.length}/{snapshot.scheduler.concurrency}{" "}
					workflow slots
				</span>
				<button
					className={CONTROL}
					type="button"
					onClick={() => void bulk("stop")}
				>
					Stop selected
				</button>
				<button
					className={DANGER}
					type="button"
					onClick={() => void bulk("remove")}
				>
					Remove selected
				</button>
			</section>
			<Scheduler state={snapshot.scheduler} />
			<Logs />
			<section className="grid gap-3">
				{snapshot.environments.map((environment) => (
					<div
						className="grid grid-cols-[1.5rem_1fr] items-start gap-2"
						key={environment.worktreeId}
					>
						<input
							aria-label={`Select ${environment.branch}`}
							type="checkbox"
							checked={selected.includes(environment.worktreeId)}
							className="mt-6 size-4 accent-emerald-700"
							onChange={(event) =>
								setSelected((current) =>
									event.target.checked
										? [...current, environment.worktreeId]
										: current.filter((id) => id !== environment.worktreeId),
								)
							}
						/>
						<EnvironmentRow environment={environment} />
					</div>
				))}
			</section>
		</main>
	);
}
