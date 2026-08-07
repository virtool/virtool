/**
 * A background task's live progress and metadata, as it is embedded in the
 * resources a task acts on.
 */
export type Task = {
	complete: boolean;
	createdAt: Date;
	error: string | null;
	id: number;
	progress: number;
	step: string;
	type: string;
};
