WORKFLOW_NAMES = (
    "jobs_build_index",
    "jobs_create_sample",
    "jobs_create_subtraction",
    "jobs_nuvs",
    "jobs_pathoscope",
)


def compute_progress(state: str, steps: list[dict] | None) -> int:
    """Compute a job's progress percentage from its state and steps."""
    if state in ("succeeded", "failed", "cancelled"):
        return 100

    if state != "running" or not steps:
        return 0

    started = sum(1 for s in steps if s.get("started_at") is not None)

    return int(started / len(steps) * 100)
