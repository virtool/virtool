# Coasts development plan

Make parallel worktrees inexpensive to start, easy to identify in the browser,
and independent in application state. Use Compose through Coasts for everyday
development. Keep Tilt/Minikube available until workflow execution and the
normal development loop have replacements.

This file tracks continuing work. Unchecked items are proposed work, not
implemented behavior. Setup and operational instructions live in
[dev/README.md](dev/README.md).

## Completed foundation

- [x] Checkpoint the initial trial on `chore/coasts-dev`: `fc1d405a7`.
- [x] Commit shared-service support: `74fa5ba2a`.
- [x] Run web, jobs API, tasks, migrations, and initialization with Compose
  through Coasts, without Kubernetes.
- [x] Share Postgres 18 and Azurite 3.37.0 across instances while giving each
  instance a separate database and blob container.
- [x] Persist a random instance data ID in an isolated configuration volume.
  Initialize explicitly because Coasts 0.1.53 does not invoke its documented
  automatic database creation/injection during startup.
- [x] Run Vite as the mounted source owner's UID/GID; keep dependencies and
  caches in containers and mount shared package source read-only.
- [x] Verify two-instance database/blob isolation, persistence across restart,
  initialization idempotence, and Azure SDK upload/download without
  `--skipApiVersionCheck`.
- [x] Pass `pnpm check`, `pnpm typecheck`, and `pnpm knip` before committing.

## Data lifecycle decision

Removing a worktree deletes its Coast, database, and blob container. Stopping
an instance preserves its data for resume. Recreating a removed worktree starts
with fresh data under the selected initialization policy; retained-data
recovery is not part of this plan. Cleanup must be retryable after partial
failure and must never delete another instance's data or shared-service volumes.

## Decisions awaiting input

| Question | Proposed default | Consequence |
| --- | --- | --- |
| What data should a new worktree start with? | A reusable development seed. | Requires a maintained seed containing matching database rows and blobs. Empty setup remains useful for onboarding tests. |

Proposed interaction: `wt switch -c fix-thing` starts that worktree's Coast in
the background. Returning with `wt switch fix-thing` resumes the same instance
if stopped. Switching terminals leaves other instances running and does not
redirect existing browser tabs. Worktrunk's `--no-hooks` provides an explicit
way to create a worktree without starting services.

## 1. Integrate Worktrunk lifecycle

Worktrunk 0.75.0 is installed. Its switch hook runs startup in the background;
`pre-remove` runs while the worktree still exists. The controller provisions a
Coast with autostart disabled, writes its data identity, and assigns its worktree
before starting services. In Coasts 0.1.53, raw rebuild bypasses shared-service
overrides, so the controller builds images explicitly and uses the effective
Compose configuration.

- [ ] Define and persist the mapping between repository, worktree, Coast
  instance, data ID, and browser URL. Use readable names with collision checks;
  do not rely solely on replacing slashes in branch names. Account for branch
  renames and removal/recreation of a worktree.
- [ ] Implement an idempotent ensure-running operation: create if missing,
  resume if stopped, leave a healthy instance alone. Serialize concurrent
  requests for the same instance and avoid duplicate builds across worktrees.
- [ ] Connect background startup/resume to `.config/wt.toml`. Both `post-start`
  and `post-switch` fire on creation; choose one owner for startup or guard
  duplicate calls. Do not rebuild unchanged images on every switch.
- [ ] Check daemon availability, installed Coast version, and executable path;
  provide actionable errors and a manual retry command. Expose readiness and
  background failure logs rather than treating successful `wt switch` as
  proof the application is ready.
- [ ] Replace the current `pre-remove = "mise run destroy || true"` Minikube
  hook with cleanup of the worktree's Coast, database, and blob container.
  Stop instance writers before deleting data. Keep the data mapping until all
  cleanup succeeds, including across partial failures and retries. Report
  failures and block worktree removal rather than silently leaving old data.
  Serialize cleanup with startup/resume for the same instance.
- [ ] Handle switching from older branches whose project config or scripts
  still use Tilt. Worktrunk reads project hooks from the invoking worktree;
  document rollout and fallback behavior rather than assuming every branch
  already has this integration.
- [ ] Review the blocking `pre-start = "pnpm install"`: retain host dependencies
  needed by editors/checks, but avoid making unnecessary installation a
  prerequisite for container startup.
- [ ] Replace the hash-port URL in `wt list` with the instance's actual URL
  once browser origins are ready. Verify support for persisted URL metadata
  in the installed Worktrunk version.

Acceptance: create two worktrees, start both, switch repeatedly, stop/resume
one, and remove one. Each operation targets the correct instance, preserves
the other instance, preserves data on stop/resume, and deletes the removed
instance's data. Exercise startup and partial cleanup failures, retry,
concurrent requests, and names containing slashes or spaces.

## 2. Give every browser tab a stable instance

Managed instances use Caddy and the shared Coast CA, with a fixed HTTPS origin
at their unique hostname and dynamic port. Legacy manually started trials still
authenticate at `http://localhost:9900`. Browser validation is required before
marking the multi-tab acceptance complete.

- [ ] Choose and implement a stable per-instance origin, using Coasts routing
  if sufficient or a shared local proxy if needed. Resolve HTTPS and passkey
  requirements before choosing a hostname scheme.
- [ ] Configure `VT_PUBLIC_ORIGIN`, auth callbacks, and cookie isolation per
  instance. Switching the checked-out Coast must not change another tab's
  application or session.
- [ ] Verify HMR, authenticated requests, uploads/downloads, and event streams
  through the chosen origin.
- [ ] Display the worktree/branch and Coast instance in Virtool's development
  UI and tab title. Add a development-only switcher linking to other instances;
  keep discovery/control access local and out of production builds.
- [ ] Reuse `wt list` and the Coast dashboard for overview initially. Evaluate
  whether a separate TUI adds anything after lifecycle and browser switching
  work reliably.
- [ ] Verify occupied-port handling, including fixed shared-service ports,
  alongside the existing test Compose stack and optional Minikube environment.

Acceptance: two authenticated tabs stay on their respective worktrees while
the terminal switches between them; identity is visible and links open the
intended instance without port conflicts.

## 3. Shorten feedback loops

- [ ] Record cold build, cached build, new-instance startup, stopped-instance
  resume, web edit, and internal-service edit times before optimizing.
- [ ] Reduce core-stack build/export overhead. Coasts currently scans base
  images from the root Dockerfile, including Rust/Python/tool stages that the
  core UI loop does not need. Verify the installed release's behavior and
  narrow the development build inputs without duplicating shipped image logic.
- [ ] Add watch/restart development execution for jobs API and tasks; internal
  source is currently baked into images. Preserve correct branch assignment,
  graceful shutdown, and explicit migration behavior.
- [ ] Make dependency changes trigger the necessary install/rebuild while
  ordinary source edits avoid it. Keep generated files owned by the developer.
- [ ] Provide a documented non-root shell/exec path. Automatic Vite startup is
  non-root, but manual Coast shells and Docker exec can still write as root.
- [ ] Repeat the timing measurements and record improvements and remaining
  costs in the development documentation.

Acceptance: web and internal source edits reach the running application
without manual image rebuilds; dependency changes remain correct; source
mounts acquire no root-owned files during supported development commands.

## 4. Restore workflow execution without local Kubernetes

- [ ] Choose an explicit one-shot workflow launcher or bounded local worker
  mechanism. Match job claim, ping, cancellation, finalization, and exit
  contracts; local KEDA scaling is not required.
- [ ] Run workflow images against the owning instance's jobs API and storage.
  Bound concurrency so several worktrees cannot exhaust the host.
- [ ] Keep bioinformatics image layers cached and build only required targets.
  Add any new workflow/crate build inputs to CI filters as required by AGENTS.
- [ ] Exercise sample creation, subtraction creation, Pathoscope, and NuVs,
  including cancellation and failure cleanup.

Acceptance: representative workflows complete end to end in Coasts, with no
cross-instance job claims or storage writes and no Minikube dependency.

## 5. Make data management routine

Implement retryable data deletion with automatic Coast removal in step 1.
Seed/import work can follow core lifecycle integration.

- [ ] Add list and reset operations targeting one instance's database and blob
  container. Never reset shared-service volumes to reset a single worktree.
- [ ] Keep pending cleanup identities outside Coast configuration volumes and
  Worktrunk branch state that may be deleted during removal. Delete their
  mappings once the instance and its data are gone.
- [ ] Implement the chosen new-worktree data policy, keeping database records
  and referenced blobs consistent. Make schema compatibility failures clear.
- [ ] Identify and clean up orphaned databases/blob containers from failed or
  bypassed hooks and manual Coast removal. Show their origin before cleanup.
  Document shared-service upgrade procedures.

Acceptance: removing a worktree leaves no database or blob container for that
instance; recreating it starts with fresh data. Partial cleanup can be retried
without affecting another instance. Reset and seed leave a usable application
with valid stored-object references.

## 6. Finish the transition

- [ ] Update root development commands, Worktrunk configuration, and docs to
  make Coasts the normal path once browser and workflow parity are validated.
- [ ] Decide whether to retain Tilt/Minikube as an optional Kubernetes/KEDA
  validation environment or remove it. Do not remove it before its remaining
  development uses have a replacement.
- [ ] Document fresh-machine setup and validate it from a clean worktree,
  including shared services, data initialization, browser access, and cleanup.

## References

- [Worktrunk hooks](https://worktrunk.dev/hook/): lifecycle hooks, background
  execution, templates, and logs. Also checked installed `wt hook --help`.
- [Worktrunk switch implementation](https://github.com/max-sixty/worktrunk/blob/main/src/commands/worktree/switch.rs):
  creation triggers both creation and switch hooks; existing worktrees trigger
  the switch hook.
- Installed `coast run --help` and the current [Coastfile](Coastfile) define
  the available assignment mechanism and project configuration. Verify release
  behavior before adopting features documented only on upstream main.
