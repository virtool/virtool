# Job lifecycle

`@virtool/workflow` and `@virtool/jobs-api` divide the workflow run from the
job lifecycle. The workflow runtime executes steps and returns an outcome. The
jobs API owns the persisted job state and the protocol a workflow pod uses to
claim, update, and finish a job.

## Ownership boundary

`runWorkflow` knows nothing about the network, process signals, or process
exit. It runs an explicit ordered list of steps and returns a `RunOutcome`.

`runWorkflowApp`, the entrypoint called by each workflow app's `main.ts`, owns
the lifecycle around that run:

- installing the `SIGTERM` handler;
- claiming a job;
- constructing the jobs API client and run context;
- starting and stopping the ping loop;
- reporting step starts and successful completion;
- flushing Sentry; and
- selecting the pod's exit code.

The lifecycle implementation is split among `createJobsApiClient`, `claimJob`,
`startPingLoop`, and `runWorkflowApp`. Wire shapes come from
`@virtool/contracts`; neither side redeclares them.

## Protocol

Jobs API paths are unprefixed and all wire fields are camel case. The workflow
pod connects to the cluster-internal jobs API service through `baseUrl`, never
through the public web origin.

The normal sequence is:

1. `claimJob` polls `POST /jobs/claim?workflow=...` without authentication.
2. The jobs API atomically moves an available job from `pending` to `running`
   and returns its id and credential.
3. The pod reads the complete job from `GET /jobs/{id}`. The claim response does
   not carry the job arguments.
4. The pod starts the ping loop and calls
   `POST /jobs/{id}/steps/{stepId}/start` before each step.
5. The pod finalizes the resource produced by the workflow, if any.
6. After a successful run, it calls `POST /jobs/{id}/finish`, which moves the
   job from `running` to `succeeded`.

A pod learns its job id and credential from the claim response and nowhere
else. An aborted claim returns `null`; both the overall claim timeout and a
`SIGTERM` arrive through that result.

## Cancellation

The ping loop is the cancellation channel. `JobPing` contains only `pingedAt`;
there is deliberately no `cancelled` flag.

When a job enters any terminal state, its credential stops authenticating. The
next ping receives `401`, and the ping loop calls `signals.cancel()`. The run
then cooperatively abandons its active step and returns `cancelled`.

This design covers more than user cancellation. A job may already be
`cancelled`, `failed` by the stalled-job sweep, or `succeeded`. In every case,
the credential refusal tells the pod that the job is no longer active and that
it has nothing left to report.

The jobs API names a terminal state in the `401` response body only after the
presented credential has been verified. The runner logs that message but does
not branch on it. A genuinely broken credential also produces `401`; seeing
`Invalid credentials` instead of `Job is cancelled.` in the logs preserves the
distinction for operators without changing the runner's response.

## Workflow failure

There is deliberately no endpoint for a runner to report failure. If a step or
workflow finalization fails, `runWorkflow` returns `failed`, the pod stops
pinging, and `runWorkflowApp` exits `0`. The stalled-job sweep eventually moves
the job from `running` to `failed` after its last ping becomes more than five
minutes old.

Exiting `0` is essential: a non-zero exit would make the Kubernetes
`ScaledJob` retry the pod and repeat workflow work. Failure is represented by
the API-side job transition, not by the container exit status.

If the workflow succeeds but the finish request fails, the pod also exits `0`.
The outputs have already been written, so retrying the pod would duplicate the
work; the job is left for the same stalled-job sweep.

## Pings and retries

Ordinary jobs API requests retry transport failures five times with a flat
five-second delay. They never retry an HTTP response chosen by the jobs API.

Ping requests disable that client retry policy because the ping loop owns its
failure budget:

- `401` is neither retried nor counted; it cancels the run immediately.
- Other failures are counted consecutively and a success resets the count.
- After five consecutive failures, roughly 20 seconds, the loop logs a warning
  and stops pinging but lets the workflow continue.

That give-up window must remain well inside the five-minute stalled-job
timeout. If connectivity returns after the sweep has failed the job, another
lifecycle request is refused because the credential is no longer valid.

## Outcomes and exit codes

| Event | Job transition | Pod exit code |
| --- | --- | ---: |
| Workflow succeeds and `finish` succeeds | `running` to `succeeded` | `0` |
| Workflow fails | `running` to `failed` later, by the stalled-job sweep | `0` |
| User cancels the job | active state to `cancelled`; the next ping cancels the run | `0` |
| Finish cannot be reported | `running` to `failed` later, by the stalled-job sweep | `0` |
| Claim times out before a job is acquired | none | `0` |
| Pod infrastructure or preparation fails | no runner-driven terminal transition | `1` |
| Pod receives `SIGTERM` | no runner-driven terminal transition | `124` |

Only a broken pod exits `1`. `SIGTERM` exits `124`, which lets the orchestrator
distinguish intentional termination. If termination occurs after claim, the
job is eventually handled by the stalled-job sweep because the runner makes no
terminal transition.

## Testing the lifecycle

The test harness in `@virtool/workflow/testing` exposes the jobs API contract in
two forms over one `JobsApiState` object:

- workflow tests use `createFakeJobsApiClient(state)` and avoid HTTP;
- runtime tests use `startJobsApiTestServer(state)` and exercise a real
  `node:http` server on an ephemeral port.

Both forms route through `handleJobsApiRequest`. Responses are serialized and
parsed with the same contract schemas as production, so the fake client cannot
silently accept a wire shape that the real client would reject. The shared state
records claims, step starts, finish and finalize calls, cache registrations,
resource metadata, credentials, and the injected clock.

The embedded server preserves the lifecycle behavior described above:

- claims are unauthenticated and filtered by workflow;
- every later request uses HTTP Basic credentials and verifies route job IDs;
- terminal jobs reject every authenticated route with `401`;
- duplicate step starts return `409`;
- successful finalization updates the resource metadata served by later reads;
- arbitrary responses, hung responses, and destroyed sockets can be queued to
  test the distinction between HTTP decisions and retryable transport failures.

This split keeps workflow tests focused on workflow outputs while allowing the
runtime tests to cover retries, ping-driven cancellation, authentication, and
status mapping over a real wire. See the package's
[workflow testing reference](../packages/workflow/TESTING.md) for setup,
builders, subprocess and storage fakes, work paths, and checksum helpers.

## Related documentation

- [`@virtool/workflow`](../packages/workflow/README.md) documents the runtime,
  subprocess, file-transfer, cache, and configuration contracts.
- [`@virtool/jobs-api`](../apps/jobs-api/README.md) documents service deployment
  and configuration.
- [Workflow testing](../packages/workflow/TESTING.md) documents the complete
  shared test harness.
