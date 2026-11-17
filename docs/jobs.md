# Job lifecycle

A workflow pod and the jobs API divide the work of a job. The pod runs the
workflow steps. The jobs API owns the persisted job state and the protocol that
a pod uses to claim, update, and finish a job.

See [`@virtool/workflow`](../packages/workflow/README.md) for pod configuration
and [`@virtool/internal`](../apps/internal/README.md) for the jobs API service.

## Protocol

A pod connects to the cluster-internal jobs API service, never to the public web
origin.

The normal sequence is:

1. The pod polls the jobs API for a job of its workflow. This request has no
   credential.
2. The jobs API atomically moves an available job from `pending` to `running`
   and returns its ID and credential. A pod gets these from the claim response
   and from nowhere else.
3. The pod reads the complete job, because the claim response doesn't contain
   the job arguments.
4. The pod starts to ping and reports each step before it starts.
5. The pod finalizes the resource that the workflow made, if any.
6. After a successful run, the pod finishes the job, which moves it from
   `running` to `succeeded`.

A pod stops polling when `VT_TIMEOUT` passes or when it receives `SIGTERM`.

## Cancellation

The ping is the cancellation channel. When a job enters any terminal state, its
credential stops authenticating. The next ping receives `401`, and the pod
abandons its active step and stops. This covers a job that a user cancelled, a
job that the stalled-job sweep failed, and a job that succeeded.

A broken credential also receives `401`, and the pod has the same response. The
log tells the two apart: the jobs API names the terminal state, such as
`Job is cancelled.`, only after it verifies the credential. Other refusals say
`Invalid credentials`.

## Workflow failure

A pod can't report a failure to the jobs API. If a step or finalization fails,
the pod stops pinging and exits `0`. The stalled-job sweep then moves the job
from `running` to `failed` when its last ping is more than five minutes old.

If the workflow succeeds but the finish request fails, the pod also exits `0`,
and the same sweep fails the job.

A failed job therefore shows a successful pod in Kubernetes. Look at the job
state, not the container exit status. A non-zero exit makes the `ScaledJob` run
the pod again.

## Pings and retries

Ordinary jobs API requests retry transport failures and `503` responses every
five seconds, until four minutes after the first attempt. They don't retry any
other HTTP response. The jobs API answers `503` while its database is
unreachable, for example during a Postgres maintenance restart.

A ping doesn't use those retries:

- `401` cancels the run immediately.
- After other failures, the pod continues to ping until four minutes after the
  last successful ping.
- At that deadline, the pod logs a warning and stops pinging, but the workflow
  continues.

A running job survives a database outage of up to four minutes. A longer outage
fails the job. If connectivity returns after the sweep fails the job, the jobs
API refuses the pod's requests because its credential is no longer valid.

During a `503`, a polling pod waits for the `Retry-After` delay and polls again.
It logs one warning for each outage.

## Outcomes and exit codes

| Event | Job transition | Pod exit code |
| --- | --- | ---: |
| Workflow succeeds and `finish` succeeds | `running` to `succeeded` | `0` |
| Workflow fails | `running` to `failed` later, by the stalled-job sweep | `0` |
| User cancels the job | active state to `cancelled`; the next ping cancels the run | `0` |
| Finish can't be reported | `running` to `failed` later, by the stalled-job sweep | `0` |
| Claim times out before a job is acquired | none | `0` |
| Pod infrastructure or preparation fails | no runner-driven terminal transition | `1` |
| Pod receives `SIGTERM` | no runner-driven terminal transition | `124` |

If a pod stops after its claim without a terminal transition, the stalled-job
sweep handles the job.
