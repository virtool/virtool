/** The state an environment should reconcile toward. */
export type DesiredState = "absent" | "stopped" | "up";

/** The state currently observed from Docker and readiness checks. */
export type ObservedState =
	| "failed"
	| "missing"
	| "not_created"
	| "removing"
	| "running"
	| "starting"
	| "stopped"
	| "stopping";

/** A Git worktree and its optional development environment. */
export type Environment = {
	age: number | null;
	branch: string;
	desired: DesiredState;
	id: string | null;
	lastError: string | null;
	name: string | null;
	observed: ObservedState;
	operation: Operation | null;
	path: string;
	ready: boolean;
	services: Record<string, ServiceState>;
	url: string | null;
	workflowEnabled: boolean;
	worktreeId: string;
};

/** Observed health for one Compose service. */
export type ServiceState = "healthy" | "missing" | "stopped" | "unhealthy";

/** Progress for one asynchronous lifecycle operation. */
export type Operation = {
	action: "remove" | "start" | "stop";
	createdAt: number;
	error: string | null;
	id: number;
	progress: string;
	status: "failed" | "pending" | "running" | "succeeded";
};

/** Health of repository-wide shared infrastructure. */
export type SharedState = {
	initialized: boolean;
	lastError: string | null;
	services: Record<string, ServiceState>;
};

/** Runtime state of the global workflow scheduler. */
export type SchedulerState = {
	active: Array<{ environmentId: string; workflow: Workflow }>;
	buildQueue: Array<{ environmentId: string; workflow: Workflow }>;
	capacity: number;
	concurrency: number;
	lastError: string | null;
	queues: Record<string, Partial<Record<Workflow, number>>>;
};

/** A complete management UI state snapshot. */
export type Snapshot = {
	environments: Environment[];
	repositoryId: string;
	scheduler: SchedulerState;
	shared: SharedState;
	updatedAt: number;
	updateAvailable: boolean;
};

/** One supported bioinformatics workflow. */
export type Workflow =
	| "create_sample"
	| "create_subtraction"
	| "nuvs"
	| "pathoscope";

/** A lifecycle mutation accepted by the daemon. */
export type Mutation = {
	action:
		| "disable_workflows"
		| "enable_workflows"
		| "remove"
		| "restart"
		| "retry"
		| "start"
		| "stop";
	worktreeIds: string[];
};
