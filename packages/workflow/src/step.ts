import type { JobWorkflow, JsonObject } from "@virtool/contracts";
import type { BuildContext, WorkflowContext } from "./context";
import { WorkflowDefinitionError } from "./errors";

/**
 * The shape a step id must take.
 *
 * `snake_case`, because the id is the Python function name a ported step is
 * carried over from, and the control plane stores it verbatim.
 */
const STEP_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * A step's metadata, without the function that runs it.
 *
 * The three fields the control plane is told about at claim time, matching
 * `JobStepDefinition` on the wire. Hook payloads carry this rather than the
 * step itself so the hook registry does not have to be generic over a
 * workflow's data and state.
 */
export type WorkflowStepMetadata = {
	id: string;
	name: string;
	description: string;
};

/** A single step in a workflow. */
export type WorkflowStep<TData, TState> = {
	/**
	 * Stable `snake_case` id reported to the control plane. Matches the ported
	 * Python function name.
	 *
	 * Authored explicitly and never derived from the display name: it is what
	 * `POST /jobs/{jobId}/steps/{stepId}/start` takes, so slugifying a label
	 * would change the shape of a job's step list at cutover.
	 */
	id: string;
	/** Display name. Defaults to the title-cased id. */
	name?: string;
	/** One-line description, from the Python docstring's first line. */
	description: string;
	run: (context: WorkflowContext<TData, TState>) => Promise<void>;
};

/** A step with its display name resolved. */
export type ResolvedWorkflowStep<TData, TState> = WorkflowStep<
	TData,
	TState
> & {
	name: string;
};

/** Everything a workflow app declares about itself. */
export type WorkflowDefinition<TData, TState> = {
	name: JobWorkflow;
	/** Eagerly builds the serializable data half of the context. */
	buildContext: BuildContext<TData>;
	/** Fresh mutable scratch for the run. */
	createState: () => TState;
	steps: readonly WorkflowStep<TData, TState>[];
	/**
	 * Derives the result payload the job lifecycle loop sends with its finalize
	 * call. Omit when the workflow has no result.
	 *
	 * The run loop never calls this — it reports only how the run ended, and a
	 * result is meaningful only once the run has succeeded.
	 */
	result?: (state: TState) => JsonObject;
};

/** A validated workflow, ready to run. */
export type Workflow<TData, TState> = Omit<
	WorkflowDefinition<TData, TState>,
	"steps"
> & {
	steps: readonly ResolvedWorkflowStep<TData, TState>[];
};

/**
 * Title-case an id the way Python's `str.title()` does.
 *
 * `map_default_isolates` becomes `Map Default Isolates`, so a ported step keeps
 * the label the UI already shows for it. Python uppercases any letter whose
 * predecessor is not a letter, which is why this matches on the boundary rather
 * than splitting on spaces.
 */
function titleCase(id: string): string {
	return id
		.replaceAll("_", " ")
		.replace(
			/(^|[^a-z])([a-z])/g,
			(_, boundary: string, letter: string) =>
				`${boundary}${letter.toUpperCase()}`,
		);
}

/**
 * Validate a workflow definition and resolve its step display names.
 *
 * There is no module scanning. Python's `collect()` reads a module's `__dict__`
 * to pick up decorated functions in definition order; bundling and tree-shaking
 * make that order an unsafe thing to depend on, so steps are an explicit
 * ordered array instead.
 *
 * @throws {WorkflowDefinitionError} when the workflow declares no steps, or a
 *   step has an id that is not `snake_case`, an id shared with another step, or
 *   an empty description.
 */
export function defineWorkflow<TData, TState>(
	definition: WorkflowDefinition<TData, TState>,
): Workflow<TData, TState> {
	const { name, steps } = definition;

	if (steps.length === 0) {
		throw new WorkflowDefinitionError(`workflow ${name} declares no steps`);
	}

	const seen = new Set<string>();

	const resolved = steps.map((step) => {
		if (!STEP_ID_PATTERN.test(step.id)) {
			throw new WorkflowDefinitionError(
				`workflow ${name} step "${step.id}" has an invalid id: ids must be snake_case, matching ${STEP_ID_PATTERN.source}`,
			);
		}

		if (seen.has(step.id)) {
			throw new WorkflowDefinitionError(
				`workflow ${name} step "${step.id}" has an id already used by an earlier step`,
			);
		}

		seen.add(step.id);

		if (step.description.trim() === "") {
			throw new WorkflowDefinitionError(
				`workflow ${name} step "${step.id}" has an empty description`,
			);
		}

		return { ...step, name: step.name ?? titleCase(step.id) };
	});

	return { ...definition, steps: resolved };
}
