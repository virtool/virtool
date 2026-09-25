import {
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	RouterProvider,
	useLocation,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import {
	Check,
	Circle,
	CircleX,
	Copy,
	Download,
	ExternalLink,
	LoaderCircle,
	Pause,
	Play,
	Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
	Environment,
	Mutation,
	Operation,
	SchedulerState,
	ServiceState,
	Workflow,
} from "../shared/types.ts";
import { Button, buttonClassName } from "./Button.tsx";
import { useSnapshot } from "./store.ts";

const PANEL = "rounded-xl border border-slate-200 bg-white";
const SECTION_HEADING = "text-sm font-semibold text-slate-600";
const TAB =
	"cursor-pointer border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:text-emerald-900 data-[state=active]:border-emerald-700 data-[state=active]:text-emerald-900";

const STARTUP_STAGES = [
	["queued", "Queued"],
	["checking configuration", "Check configuration"],
	["starting shared infrastructure", "Start shared infrastructure"],
	["rendering configuration", "Render configuration"],
	["initializing database and storage", "Initialize database and storage"],
	["building core image", "Build core image"],
	["running migrations", "Run migrations"],
	["starting services", "Start services"],
	["checking HTTPS readiness", "Check HTTPS readiness"],
] as const;

const WORKFLOW_LABELS: Record<Workflow, string> = {
	create_sample: "Create sample",
	create_subtraction: "Create subtraction",
	nuvs: "NUVs",
	pathoscope: "Pathoscope",
};

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
	function clear(): void {
		setError(null);
		setMessage(null);
	}
	async function run(
		action: () => Promise<void>,
		success: string | null,
	): Promise<boolean> {
		setPending(true);
		clear();
		try {
			await action();
			setMessage(success);
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			return false;
		} finally {
			setPending(false);
		}
	}
	return { pending, error, message, clear, run };
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
	storage,
}: {
	services: Record<string, ServiceState>;
	storage: { azurite: number | null; postgres: number | null };
}) {
	const entries = [
		...Object.keys(services),
		...(["postgres", "azurite"] as const).filter((name) => !(name in services)),
	];
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
			{entries.map((name) => {
				const health = services[name];
				const volumeSize = storage[name as keyof typeof storage];
				return (
					<article
						aria-label={`${name} service`}
						className={`${PANEL} flex items-center justify-between gap-3 p-4`}
						key={name}
					>
						<div>
							<h3 className="font-semibold text-emerald-950">{name}</h3>
							{volumeSize !== undefined && (
								<p className="mt-1 text-xs text-slate-500">
									Volume usage: <span>{formatBytes(volumeSize)}</span>
								</p>
							)}
						</div>
						{health && (
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
						)}
					</article>
				);
			})}
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

function formatElapsed(milliseconds: number): string {
	const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${seconds % 60}s`;
}

function StartupTimeline({ operation }: { operation: Operation }) {
	const [now, setNow] = useState(() => Date.now());
	const isActive = ["pending", "running"].includes(operation.status);
	useEffect(() => {
		if (!isActive) {
			return;
		}
		const timer = window.setInterval(() => setNow(Date.now()), 1_000);
		return () => window.clearInterval(timer);
	}, [isActive]);
	const currentIndex = STARTUP_STAGES.findIndex(
		([progress]) => progress === operation.progress,
	);
	const elapsed = (operation.finishedAt ?? now) - operation.createdAt;
	return (
		<section
			aria-label="Startup timeline"
			className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
		>
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="text-sm font-semibold text-emerald-950">Startup</h3>
				<time className="text-xs tabular-nums text-slate-500">
					{formatElapsed(elapsed)} elapsed
				</time>
			</div>
			<ol className="mt-3 space-y-2">
				{currentIndex === -1 && operation.status !== "succeeded" && (
					<li
						className={`flex items-center gap-2 text-sm font-semibold ${
							operation.status === "failed" ? "text-red-800" : "text-amber-900"
						}`}
					>
						{operation.status === "failed" ? (
							<CircleX aria-hidden="true" className="size-4 shrink-0" />
						) : (
							<LoaderCircle
								aria-hidden="true"
								className="size-4 shrink-0 animate-spin"
							/>
						)}
						<span className="capitalize">{operation.progress}</span>
						{operation.status === "failed" && (
							<span className="sr-only"> (failed)</span>
						)}
					</li>
				)}
				{STARTUP_STAGES.map(([progress, label], index) => {
					const isCurrent = index === currentIndex;
					const isFailed = isCurrent && operation.status === "failed";
					const isComplete =
						operation.status === "succeeded" ||
						(currentIndex !== -1 && index < currentIndex);
					return (
						<li
							aria-current={isCurrent && isActive ? "step" : undefined}
							className={`flex items-center gap-2 text-sm ${
								isFailed
									? "font-semibold text-red-800"
									: isCurrent
										? "font-semibold text-amber-900"
										: isComplete
											? "text-emerald-800"
											: "text-slate-400"
							}`}
							key={progress}
						>
							{isFailed ? (
								<CircleX aria-hidden="true" className="size-4 shrink-0" />
							) : isComplete ? (
								<Check aria-hidden="true" className="size-4 shrink-0" />
							) : isCurrent ? (
								<LoaderCircle
									aria-hidden="true"
									className="size-4 shrink-0 animate-spin"
								/>
							) : (
								<Circle aria-hidden="true" className="size-4 shrink-0" />
							)}
							<span>{label}</span>
							{isFailed && <span className="sr-only"> (failed)</span>}
						</li>
					);
				})}
			</ol>
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

function isFailed(environment: Environment): boolean {
	return (
		environment.observed === "failed" ||
		environment.observed === "missing" ||
		Boolean(environment.lastError)
	);
}

function getEnvironmentTier(environment: Environment): number {
	if (!environment.id) {
		return 3;
	}
	if (environment.ready) {
		return 0;
	}
	if (isFailed(environment)) {
		return 1;
	}
	return 2;
}

function compareEnvironments(left: Environment, right: Environment): number {
	return (
		getEnvironmentTier(left) - getEnvironmentTier(right) ||
		left.branch.localeCompare(right.branch)
	);
}

function getEnvironmentStatus(environment: Environment): {
	label: string;
	tone: "neutral" | "good" | "bad" | "busy";
} {
	const busy = isBusy(environment);
	const failed = isFailed(environment);
	return {
		label: busy
			? environment.operation?.action === "start"
				? "Starting"
				: environment.observed.replaceAll("_", " ")
			: environment.ready
				? "Ready"
				: environment.observed.replaceAll("_", " "),
		tone: busy
			? "busy"
			: failed
				? "bad"
				: environment.ready
					? "good"
					: "neutral",
	};
}

function EnvironmentCard({
	environment,
	connected,
}: {
	environment: Environment;
	connected: boolean;
}) {
	const action = useAction();
	const workflowAction = useAction();
	const [workflowTarget, setWorkflowTarget] = useState<boolean | null>(null);
	const busy = isBusy(environment);
	const workflowChanging = workflowAction.pending || workflowTarget !== null;
	const disabled = !connected || busy || action.pending || workflowChanging;
	const status = getEnvironmentStatus(environment);
	useEffect(() => {
		if (
			workflowTarget !== null &&
			environment.workflowEnabled === workflowTarget
		) {
			setWorkflowTarget(null);
		}
	}, [environment.workflowEnabled, workflowTarget]);
	async function act(value: Mutation["action"]): Promise<void> {
		const isWorkflowAction =
			value === "enable_workflows" || value === "disable_workflows";
		if (isWorkflowAction) {
			action.clear();
			setWorkflowTarget(value === "enable_workflows");
		} else {
			workflowAction.clear();
		}
		const accepted = await (isWorkflowAction ? workflowAction : action).run(
			() =>
				post("/api/environments", {
					action: value,
					worktreeIds: [environment.worktreeId],
				}),
			isWorkflowAction ? null : "Request accepted.",
		);
		if (isWorkflowAction && !accepted) {
			setWorkflowTarget(null);
		}
	}
	const branchLink = (
		<Link
			aria-label={`View details for ${environment.branch}`}
			className="min-w-0 flex-1 cursor-pointer break-all text-sm font-semibold text-emerald-950 hover:underline"
			params={{ worktreeId: environment.worktreeId }}
			to="/worktrees/$worktreeId"
		>
			{environment.branch}
		</Link>
	);
	if (!environment.id) {
		return (
			<article className={`${PANEL} px-4 py-2.5`}>
				<div className="flex min-w-0 items-center gap-3">
					{branchLink}
					<Button disabled={disabled} onClick={() => void act("start")}>
						Create
					</Button>
				</div>
				<Feedback error={action.error} message={action.message} />
			</article>
		);
	}
	return (
		<article className={`${PANEL} p-4`}>
			<div className="flex min-w-0 items-center gap-3">
				{branchLink}
				<Badge label={status.label} tone={status.tone} />
			</div>
			<div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
				{environment.ready && environment.url ? (
					<a
						className={buttonClassName()}
						href={environment.url}
						target="_blank"
						rel="noreferrer"
					>
						Open
						<ExternalLink aria-hidden="true" />
					</a>
				) : (
					<Button disabled>
						Open
						<ExternalLink aria-hidden="true" />
					</Button>
				)}
				<Button disabled={disabled} onClick={() => void act("stop")}>
					Stop
				</Button>
				<Button disabled={disabled} onClick={() => void act("restart")}>
					Restart
				</Button>
				<Button
					aria-pressed={environment.workflowEnabled}
					disabled={disabled}
					onClick={() =>
						void act(
							environment.workflowEnabled
								? "disable_workflows"
								: "enable_workflows",
						)
					}
				>
					{workflowChanging ? (
						<LoaderCircle className="animate-spin" aria-hidden="true" />
					) : environment.workflowEnabled ? (
						<Play aria-hidden="true" />
					) : (
						<Pause aria-hidden="true" />
					)}
					Workflows
				</Button>
			</div>
			<Feedback
				error={action.error ?? workflowAction.error}
				message={action.message}
			/>
		</article>
	);
}

function EnvironmentDetails({
	environment,
	scheduler,
	connected,
}: {
	environment: Environment;
	scheduler: SchedulerState;
	connected: boolean;
}) {
	const action = useAction();
	const workflowAction = useAction();
	const [workflowTarget, setWorkflowTarget] = useState<boolean | null>(null);
	const busy = isBusy(environment);
	const workflowChanging = workflowAction.pending || workflowTarget !== null;
	const disabled = !connected || busy || action.pending || workflowChanging;
	const failed = isFailed(environment);
	const running = environment.observed === "running";
	const primary =
		failed && environment.id ? "retry" : running ? "stop" : "start";
	const status = getEnvironmentStatus(environment);
	const active = scheduler.active.filter(
		(item) => item.environmentId === environment.id,
	).length;
	const queued = Object.values(
		scheduler.queues[environment.id ?? ""] ?? {},
	).reduce((total, count) => total + (count ?? 0), 0);
	useEffect(() => {
		if (
			workflowTarget !== null &&
			environment.workflowEnabled === workflowTarget
		) {
			setWorkflowTarget(null);
		}
	}, [environment.workflowEnabled, workflowTarget]);
	async function act(value: Mutation["action"]): Promise<void> {
		if (
			value === "remove" &&
			!window.confirm(
				`Delete the database, stored files, and containers for ${environment.branch}? The Git worktree will be kept.`,
			)
		) {
			return;
		}
		const isWorkflowAction =
			value === "enable_workflows" || value === "disable_workflows";
		if (isWorkflowAction) {
			action.clear();
			setWorkflowTarget(value === "enable_workflows");
		} else {
			workflowAction.clear();
		}
		const accepted = await (isWorkflowAction ? workflowAction : action).run(
			() =>
				post("/api/environments", {
					action: value,
					worktreeIds: [environment.worktreeId],
				}),
			isWorkflowAction ? null : "Request accepted.",
		);
		if (isWorkflowAction && !accepted) {
			setWorkflowTarget(null);
		}
	}
	return (
		<section aria-label={`${environment.branch} details`}>
			<Link className={buttonClassName()} to="/">
				← Back to worktrees
			</Link>
			<article className={`${PANEL} mt-3 p-5`}>
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="min-w-0 flex-1 break-all text-xl font-semibold text-emerald-950">
						{environment.branch}
					</h2>
					<Badge label={status.label} tone={status.tone} />
					{environment.openPullRequest && (
						<a
							className="text-xs font-semibold text-blue-700 hover:underline"
							href={environment.openPullRequest.url}
							target="_blank"
							rel="noreferrer"
						>
							Open PR #{environment.openPullRequest.number} ↗
						</a>
					)}
					{environment.ready && environment.url && (
						<a
							className={buttonClassName("primary")}
							href={environment.url}
							target="_blank"
							rel="noreferrer"
						>
							Open app
							<ExternalLink aria-hidden="true" />
						</a>
					)}
					<Button
						disabled={disabled}
						variant={environment.ready ? "secondary" : "primary"}
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
										: environment.id
											? "Start"
											: "Create"}
					</Button>
				</div>
				{environment.operation?.action === "start" ? (
					<StartupTimeline operation={environment.operation} />
				) : (
					busy && (
						<p role="status" className="mt-3 text-sm text-amber-900">
							{environment.operation?.progress ||
								"Waiting for environment state…"}
						</p>
					)
				)}
				<Feedback
					error={action.error ?? workflowAction.error}
					message={action.message}
				/>
				{(environment.lastError || (failed && environment.id)) && (
					<div className="flex flex-wrap items-start gap-2">
						{environment.lastError && (
							<pre
								role="alert"
								className="mt-3 min-w-0 flex-1 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-3 text-sm text-red-800"
							>
								{environment.lastError}
							</pre>
						)}
						{failed && environment.id && (
							<Link
								className={buttonClassName("secondary", "mt-3")}
								search={{
									environment: environment.worktreeId,
									service: undefined,
								}}
								to="/logs"
							>
								View logs
							</Link>
						)}
					</div>
				)}
				<div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
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
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
						<span>
							{active} workflows running · {queued} queued
						</span>
						{!environment.workflowEnabled && <span>Workflows paused</span>}
					</div>
					<Services services={environment.services} />
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={disabled || !environment.id}
							onClick={() => void act("restart")}
						>
							Restart
						</Button>
						<Button
							aria-pressed={environment.workflowEnabled}
							disabled={disabled || !environment.id}
							onClick={() =>
								void act(
									environment.workflowEnabled
										? "disable_workflows"
										: "enable_workflows",
								)
							}
						>
							{workflowChanging ? (
								<LoaderCircle className="animate-spin" aria-hidden="true" />
							) : environment.workflowEnabled ? (
								<Play aria-hidden="true" />
							) : (
								<Pause aria-hidden="true" />
							)}
							Workflows
						</Button>
						<Button
							disabled={disabled || !environment.id}
							variant="danger"
							onClick={() => void act("remove")}
						>
							Delete environment data
						</Button>
					</div>
				</div>
			</article>
		</section>
	);
}

function Scheduler({
	state,
	environments,
	connected,
}: {
	state: SchedulerState;
	environments: Environment[];
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
	const environmentById = new Map(
		environments.flatMap((environment) =>
			environment.id ? [[environment.id, environment] as const] : [],
		),
	);
	const schedulerEnvironmentIds = new Set([
		...environmentById.keys(),
		...Object.keys(state.queues),
		...Object.keys(state.errors),
		...state.active.map((item) => item.environmentId),
		...state.buildQueue.map((item) => item.environmentId),
	]);
	const branches = [...schedulerEnvironmentIds]
		.map((environmentId) => ({
			environment: environmentById.get(environmentId),
			environmentId,
		}))
		.toSorted((left, right) =>
			(left.environment?.branch ?? left.environmentId).localeCompare(
				right.environment?.branch ?? right.environmentId,
			),
		);
	return (
		<section aria-labelledby="workflow-scheduler-heading" className={PANEL}>
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
				<h2
					className="font-semibold text-emerald-950"
					id="workflow-scheduler-heading"
				>
					Workflow scheduler
				</h2>
				<div className="flex flex-wrap gap-2">
					<Badge
						label={`${pending} queued`}
						tone={pending ? "busy" : "neutral"}
					/>
					<Badge
						label={`${state.active.length}/${state.concurrency} running`}
						tone={state.active.length ? "good" : "neutral"}
					/>
				</div>
			</header>
			<div className="grid gap-4 p-4">
				<Feedback
					error={action.error ?? state.lastError}
					message={action.message}
				/>
				<div className="grid gap-4 text-sm md:grid-cols-2">
					<section className="rounded-lg bg-slate-50 p-4">
						<h3 className="font-semibold text-slate-900">Capacity</h3>
						<p className="mt-2 text-slate-600">
							{state.capacity} slots available
						</p>
					</section>
					<section className="rounded-lg border border-slate-200 p-4">
						<h3 className="font-semibold text-slate-900">Settings</h3>
						<div className="mt-3 flex flex-wrap items-end gap-3">
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
							<Button
								disabled={
									!connected ||
									action.pending ||
									!Number.isInteger(concurrency) ||
									concurrency < 1 ||
									concurrency > 32 ||
									concurrency === state.concurrency
								}
								onClick={() =>
									void action.run(async () => {
										await post("/api/scheduler", { concurrency });
										setDraft(null);
									}, "Concurrency saved.")
								}
							>
								{action.pending ? "Saving…" : "Save"}
							</Button>
						</div>
					</section>
				</div>
				<section aria-labelledby="branch-activity-heading">
					<h3
						className="mb-3 font-semibold text-slate-900"
						id="branch-activity-heading"
					>
						Branch activity
					</h3>
					{branches.length === 0 ? (
						<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
							No environments are available for workflow scheduling.
						</p>
					) : (
						<div className="overflow-x-auto rounded-lg border border-slate-200">
							<table className="w-full min-w-2xl border-collapse text-left text-sm">
								<thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-3 font-semibold" scope="col">
											Branch
										</th>
										<th className="px-4 py-3 font-semibold" scope="col">
											Running
										</th>
										<th className="px-4 py-3 font-semibold" scope="col">
											Building
										</th>
										<th className="px-4 py-3 font-semibold" scope="col">
											Queued
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-200">
									{branches.map(({ environment, environmentId }) => {
										const running = state.active.filter(
											(item) => item.environmentId === environmentId,
										);
										const building = state.buildQueue.filter(
											(item) => item.environmentId === environmentId,
										);
										const queued = Object.entries(
											state.queues[environmentId] ?? {},
										).flatMap(([workflow, count]) =>
											count ? [{ count, workflow: workflow as Workflow }] : [],
										);
										return (
											<tr key={environmentId}>
												<th className="px-4 py-3 font-semibold" scope="row">
													{environment ? (
														<div className="grid justify-items-start gap-1">
															<Link
																className="break-all text-emerald-950 hover:underline"
																params={{ worktreeId: environment.worktreeId }}
																to="/worktrees/$worktreeId"
															>
																{environment.branch}
															</Link>
															{!environment.workflowEnabled && (
																<Badge label="Paused" />
															)}
														</div>
													) : (
														<span className="break-all text-slate-600">
															{environmentId}
														</span>
													)}
													{state.errors[environmentId] && (
														<p className="mt-1 break-all text-xs font-normal text-red-800">
															{state.errors[environmentId]}
														</p>
													)}
												</th>
												<td className="px-4 py-3 text-slate-600">
													<WorkflowActivity items={running} empty="Idle" />
												</td>
												<td className="px-4 py-3 text-slate-600">
													<WorkflowActivity items={building} empty="None" />
												</td>
												<td className="px-4 py-3 text-slate-600">
													{queued.length ? (
														<ul className="grid gap-1">
															{queued.map(({ count, workflow }) => (
																<li key={workflow}>
																	{WORKFLOW_LABELS[workflow]}: {count}
																</li>
															))}
														</ul>
													) : (
														"None"
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</div>
		</section>
	);
}

function WorkflowActivity({
	items,
	empty,
}: {
	items: Array<{ workflow: Workflow }>;
	empty: string;
}) {
	if (items.length === 0) {
		return empty;
	}
	const workflows = [...new Set(items.map((item) => item.workflow))];
	return (
		<ul className="grid gap-1">
			{workflows.map((workflow) => {
				const count = items.filter((item) => item.workflow === workflow).length;
				return (
					<li key={workflow}>
						{WORKFLOW_LABELS[workflow]}
						{count > 1 ? `: ${count}` : ""}
					</li>
				);
			})}
		</ul>
	);
}

function Logs({ environments }: { environments: Environment[] }) {
	const navigate = useNavigate({ from: "/logs" });
	const { environment: selectedWorktreeId, service } = logsRoute.useSearch();
	const [logs, setLogs] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [isScrollPaused, setIsScrollPaused] = useState(false);
	const output = useRef<HTMLPreElement>(null);
	const selectedEnvironment = environments.find(
		(environment) => environment.worktreeId === selectedWorktreeId,
	);
	const services = Object.keys(selectedEnvironment?.services ?? {}).sort();
	const normalizedQuery = query.trim().toLowerCase();
	const visibleLogs = normalizedQuery
		? logs
				.split("\n")
				.filter((line) => line.toLowerCase().includes(normalizedQuery))
				.join("\n")
		: logs;
	useEffect(() => {
		let active = true;
		async function refresh(): Promise<void> {
			try {
				const parameters = new URLSearchParams();
				if (selectedWorktreeId) {
					parameters.set("environment", selectedWorktreeId);
				}
				if (service) {
					parameters.set("service", service);
				}
				const response = await fetch(
					`/api/logs${parameters.size ? `?${parameters}` : ""}`,
				);
				if (!response.ok) {
					throw new Error("Unable to load logs.");
				}
				const text = await response.text();
				if (active) {
					setLogs(text);
					setError(null);
				}
			} catch {
				if (active) {
					setError("Unable to load logs.");
				}
			}
		}
		void refresh();
		const timer = setInterval(() => void refresh(), 2_000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [selectedWorktreeId, service]);
	useEffect(() => {
		if (!isScrollPaused && output.current) {
			output.current.scrollTop = output.current.scrollHeight;
		}
	}, [isScrollPaused, visibleLogs]);
	async function copyLogs(): Promise<void> {
		try {
			await navigator.clipboard.writeText(visibleLogs);
			setMessage("Copied visible logs.");
			setError(null);
		} catch {
			setError("Unable to copy logs.");
		}
	}
	function downloadLogs(): void {
		const blob = new Blob([visibleLogs], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.download = `${selectedEnvironment?.name ?? "daemon"}.log`;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
	}
	return (
		<section aria-label="Logs" className={`${PANEL} p-4`}>
			<h2 className="mb-3 text-sm font-semibold">Logs</h2>
			<div className="flex flex-wrap items-end gap-3">
				<label className="grid gap-1 text-xs font-medium text-slate-600">
					Environment
					<select
						className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
						value={selectedWorktreeId ?? ""}
						onChange={(event) =>
							void navigate({
								search: {
									environment: event.target.value || undefined,
									service: undefined,
								},
							})
						}
					>
						<option value="">Daemon</option>
						{environments
							.filter((environment) => environment.id)
							.map((environment) => (
								<option
									key={environment.worktreeId}
									value={environment.worktreeId}
								>
									{environment.branch}
								</option>
							))}
					</select>
				</label>
				<label className="grid gap-1 text-xs font-medium text-slate-600">
					Service
					<select
						className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:bg-slate-100"
						disabled={!selectedEnvironment}
						value={service ?? ""}
						onChange={(event) =>
							void navigate({
								search: {
									environment: selectedWorktreeId,
									service: event.target.value || undefined,
								},
							})
						}
					>
						<option value="">All services</option>
						{services.map((name) => (
							<option key={name}>{name}</option>
						))}
					</select>
				</label>
				<label className="relative grid min-w-48 flex-1 gap-1 text-xs font-medium text-slate-600">
					Search logs
					<Search
						aria-hidden="true"
						className="absolute bottom-2 left-2 size-4 text-slate-400"
					/>
					<input
						className="min-h-8 rounded-md border border-slate-300 bg-white py-1 pr-2 pl-8 text-sm text-slate-900"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Filter log lines"
						type="search"
						value={query}
					/>
				</label>
				<Button
					aria-pressed={isScrollPaused}
					onClick={() => setIsScrollPaused((value) => !value)}
				>
					{isScrollPaused ? (
						<Play aria-hidden="true" />
					) : (
						<Pause aria-hidden="true" />
					)}
					{isScrollPaused ? "Resume scrolling" : "Pause scrolling"}
				</Button>
				<Button disabled={!visibleLogs} onClick={() => void copyLogs()}>
					<Copy aria-hidden="true" />
					Copy
				</Button>
				<Button disabled={!visibleLogs} onClick={downloadLogs}>
					<Download aria-hidden="true" />
					Download
				</Button>
			</div>
			<Feedback error={error} message={message} />
			<pre
				aria-live="polite"
				className="mt-3 h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100"
				ref={output}
			>
				{visibleLogs ||
					(normalizedQuery ? "No matching log output" : "No log output")}
			</pre>
		</section>
	);
}

function AppContent() {
	const { snapshot, connection } = useSnapshot();
	const connected = connection === "live";
	const pathname = useLocation({ select: (location) => location.pathname });
	const { worktreeId } = useParams({ strict: false });
	const action = useAction();
	const openEnvironment = snapshot.environments.find(
		(environment) => environment.worktreeId === worktreeId,
	);
	const environments = snapshot.environments.toSorted(compareEnvironments);
	const activeEnvironments = environments.filter(
		(environment) => environment.id,
	);
	const uncreatedEnvironments = environments.filter(
		(environment) => !environment.id,
	);
	const stoppableIds = activeEnvironments
		.filter((environment) => !isBusy(environment))
		.map((environment) => environment.worktreeId);
	async function stopAll(): Promise<void> {
		if (!stoppableIds.length) {
			return;
		}
		await action.run(
			() =>
				post("/api/environments", {
					action: "stop",
					worktreeIds: stoppableIds,
				}),
			"Request accepted.",
		);
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
			<nav
				aria-label="Development environment sections"
				className="mb-5 flex border-b border-slate-200"
			>
				<Link
					aria-current={pathname === "/" || worktreeId ? "page" : undefined}
					className={TAB}
					data-state={pathname === "/" || worktreeId ? "active" : "inactive"}
					to="/"
				>
					Worktrees
				</Link>
				<Link
					aria-current={pathname === "/shared" ? "page" : undefined}
					className={TAB}
					data-state={pathname === "/shared" ? "active" : "inactive"}
					to="/shared"
				>
					Shared
				</Link>
				<Link
					aria-current={pathname === "/workflows" ? "page" : undefined}
					className={TAB}
					data-state={pathname === "/workflows" ? "active" : "inactive"}
					to="/workflows"
				>
					Workflows
				</Link>
				<Link
					aria-current={pathname === "/logs" ? "page" : undefined}
					className={TAB}
					data-state={pathname === "/logs" ? "active" : "inactive"}
					search={{ environment: undefined, service: undefined }}
					to="/logs"
				>
					Logs
				</Link>
			</nav>
			{(pathname === "/" || Boolean(worktreeId)) && (
				<section aria-label="Worktrees">
					{openEnvironment ? (
						<EnvironmentDetails
							environment={openEnvironment}
							scheduler={snapshot.scheduler}
							connected={connected}
						/>
					) : worktreeId ? (
						<p role="alert" className={`${PANEL} p-6 text-sm text-slate-600`}>
							{connected
								? "Worktree not found."
								: "Waiting for worktree state…"}
						</p>
					) : (
						<>
							<Feedback
								error={action.error}
								message={action.pending ? "Sending request…" : action.message}
							/>
							{connected && snapshot.environments.length === 0 && (
								<p className={`${PANEL} p-6 text-sm text-slate-500`}>
									No Git worktrees found. Worktrees appear here automatically
									when discovered.
								</p>
							)}
							{activeEnvironments.length > 0 && (
								<section aria-labelledby="environments-heading">
									<div className="mb-3 flex items-center gap-3">
										<h2 id="environments-heading" className={SECTION_HEADING}>
											Environments
										</h2>
										<Button
											className="ml-auto"
											disabled={
												!connected || action.pending || !stoppableIds.length
											}
											onClick={() => void stopAll()}
										>
											Stop all
										</Button>
									</div>
									<div className="grid gap-3">
										{activeEnvironments.map((environment) => (
											<EnvironmentCard
												key={environment.worktreeId}
												environment={environment}
												connected={connected}
											/>
										))}
									</div>
								</section>
							)}
							{uncreatedEnvironments.length > 0 && (
								<section
									aria-labelledby="uncreated-heading"
									className={activeEnvironments.length > 0 ? "mt-6" : ""}
								>
									<h2
										id="uncreated-heading"
										className={`mb-3 ${SECTION_HEADING}`}
									>
										No environment
									</h2>
									<div className="grid gap-2">
										{uncreatedEnvironments.map((environment) => (
											<EnvironmentCard
												key={environment.worktreeId}
												environment={environment}
												connected={connected}
											/>
										))}
									</div>
								</section>
							)}
						</>
					)}
				</section>
			)}
			{pathname === "/shared" && (
				<section aria-label="Shared" className="grid gap-3">
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
						<SharedServices
							services={snapshot.shared.services}
							storage={sharedStorage}
						/>
						<Feedback error={snapshot.shared.lastError} message={null} />
						<details className="mt-3 text-xs text-slate-500">
							<summary className="w-fit cursor-pointer">
								Infrastructure settings
							</summary>
							<p className="my-3">
								Reset deletes shared database, object storage, and HTTPS data
								for every environment.
							</p>
							<Button
								disabled={!connected || action.pending}
								variant="danger"
								onClick={() => void resetShared()}
							>
								Reset shared data
							</Button>
						</details>
					</section>
				</section>
			)}
			{pathname === "/workflows" && (
				<section aria-label="Workflows">
					<Scheduler
						state={snapshot.scheduler}
						environments={snapshot.environments}
						connected={connected}
					/>
				</section>
			)}
			{pathname === "/logs" && <Logs environments={snapshot.environments} />}
			{pathname !== "/" &&
				!worktreeId &&
				!["/shared", "/workflows", "/logs"].includes(pathname) && (
					<p role="alert" className={`${PANEL} p-6 text-sm text-slate-600`}>
						Page not found.
					</p>
				)}
		</main>
	);
}

const rootRoute = createRootRoute({
	component: AppContent,
});
const worktreesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
});
const environmentRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/worktrees/$worktreeId",
});
const sharedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/shared",
});
const workflowsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/workflows",
});
const logsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/logs",
	validateSearch: (search: Record<string, unknown>) => ({
		environment:
			typeof search.environment === "string" ? search.environment : undefined,
		service: typeof search.service === "string" ? search.service : undefined,
	}),
});
const routeTree = rootRoute.addChildren([
	worktreesRoute,
	environmentRoute,
	sharedRoute,
	workflowsRoute,
	logsRoute,
]);

function createAppRouter() {
	return createRouter({ routeTree });
}

type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation merges into TanStack Router's Register interface
	interface Register {
		router: AppRouter;
	}
}

export default function App() {
	const [router] = useState(createAppRouter);
	return <RouterProvider router={router} />;
}
