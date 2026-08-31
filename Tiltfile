local(['bash', 'dev/scripts/ensure-minikube.sh'], quiet=False)

# Each worktree runs its own dev instance in its own Kubernetes namespace. `WT`
# names that namespace and `dev/scripts/up.sh` sets it before `tilt up`. Every
# object this Tiltfile applies goes into that namespace, and the ingress host is
# derived from it, so two worktrees never collide. KEDA, ingress-nginx and the
# wildcard TLS certificate are cluster-wide singletons that
# `dev/scripts/init.sh` installs once.
WT = os.getenv('WT', '')
if not WT:
    fail('WT is not set. Start the dev instance with `bash dev/scripts/up.sh`.')

MINIKUBE_IP = str(local('minikube ip', quiet=True)).strip()
HOST = WT + '.' + MINIKUBE_IP + '.nip.io'

load('ext://namespace', 'namespace_create', 'namespace_inject')
load('ext://uibutton', 'cmd_button', 'location')

# Rewrite the shared manifests for this worktree: put every object in the `WT`
# namespace, repoint the hard-coded `default` service FQDNs at it, and swap the
# `virtool.local` ingress host for the worktree's nip.io host. The manifests
# keep `default` and `virtool.local` as literals so each stays valid on its own
# under `kubectl apply -f`.
def scoped(objects):
    text = str(objects)
    text = text.replace('default.svc.cluster.local', WT + '.svc.cluster.local')
    text = text.replace('virtool.local', HOST)
    return namespace_inject(blob(text), WT)

namespace_create(WT)

# Every live-edit target is a bool flag named after its Dockerfile stage, e.g.
# `tilt up -- --web --internal`. The web target is listed apart because it
# alone runs a dev server rather than the built artifact, so it needs an
# entrypoint and sync rules; see its docker_build below.
WEB_IMAGE = 'ghcr.io/virtool/web'

# One image, three workloads. The `internal` stage builds once; the jobs-api
# and tasks Deployments and the migration Job all run it, differentiated by the
# subcommand each passes as an argument. So `--internal` rebuilds all three.
SERVICE_TARGETS = [
    ('internal', 'ghcr.io/virtool/internal'),
]

# Every workflow is on manual trigger. A ScaledJob's pods are one-shot and only
# start when something claims work, so nothing is waiting on a rebuild — and an
# automatic one would rebuild a large image on every edit. Deploy them from the
# Tilt UI.
WORKFLOW_TARGETS = [
    ('create-sample', 'ghcr.io/virtool/create-sample'),
    ('create-subtraction', 'ghcr.io/virtool/create-subtraction'),
    ('nuvs', 'ghcr.io/virtool/nuvs'),
    ('pathoscope', 'ghcr.io/virtool/pathoscope'),
]

config.define_bool('web', usage='live edit web')

for target, image in SERVICE_TARGETS:
    config.define_bool(target, usage='live edit ' + target)

for target, image in WORKFLOW_TARGETS:
    config.define_bool(target, usage='live edit the ' + target + ' workflow')

cfg = config.parse()

cmd_button('wipe',
    argv=['bash', 'dev/scripts/wipe.sh', WT],
    icon_name="delete_forever",
    location=location.NAV,
    text='Wipe',
    requires_confirmation=True,
)

k8s_yaml(scoped(read_file('dev/manifests/data/azurite.yaml')))
k8s_yaml(scoped(read_file('dev/manifests/data/postgres.yaml')))

k8s_resource("azurite", labels=['data'])
k8s_resource("postgres", labels=['data'])

k8s_yaml(scoped(read_file('dev/manifests/config.yaml')))
k8s_yaml(scoped(read_file('dev/manifests/ingress.yaml')))

# The migration Job runs the internal image's `migrate` subcommand. It stays a
# separate Job so the long-lived processes only start after schema changes have
# been applied.
k8s_yaml(scoped(read_file('dev/manifests/migration.yaml')))

# Anything in the build context that no sync below covers forces a full image
# rebuild, which replaces the pod and costs a cold start. These paths are all
# either generated or irrelevant to the image, so a change to one must never do
# that. Shared across every docker_build below.
#
# `_tmp_*` is the important one: every host-side pnpm invocation writes
# `_tmp_<pid>_<hash>` into a folder it is about to write atomically, so a
# bare `pnpm exec ...` at the repo root drops one here and rebuilds every
# live-edited image.
#
# This file and `dev/` are excluded by `.dockerignore`, which both the daemon
# and Tilt's file watcher read, so editing the Tiltfile or a manifest does not
# rebuild seven images.
ui_monorepo_ignore = [
  '**/_tmp_*',
  '.claude/',
  '.tanstack/',
  'apps/web/.nitro/',
  'apps/web/.output/',
  'coverage/',
  '*.md',
]

# The web image is the one target that runs a dev server rather than the built
# artifact, so it carries an entrypoint and sync rules the rest have no use
# for. Tilt's `entrypoint` takes precedence over the container command in the
# Deployment, so the manifest's `npm start` does not apply to this build.
if cfg.get('web', False):
    docker_build(
      WEB_IMAGE,
      '.',
      entrypoint='pnpm --filter @virtool/web exec vite --host 0.0.0.0 --port 9900',
      target='dev',
      ignore=ui_monorepo_ignore,
      live_update=[
        fall_back_on([
          './pnpm-lock.yaml',
          './pnpm-workspace.yaml',
          './package.json',
          './apps/web/package.json',
          './apps/web/vite.config.js',
        ]),
        sync('./apps/web/src', '/repo/apps/web/src'),
        sync('./packages', '/repo/packages'),
      ]
    )

for target, image in SERVICE_TARGETS:
    if cfg.get(target, False):
        docker_build(image, '.', target=target, ignore=ui_monorepo_ignore)

k8s_yaml(scoped(kustomize('dev/manifests/web')))
k8s_yaml(scoped(kustomize('dev/manifests/virtool')))

k8s_resource(
    labels=['data'],
    new_name='config',
    objects=['virtool-env:configmap'],
)

# Host port 0 lets Tilt pick a free local port, so concurrent worktrees never
# fight over one. The bound port shows in the Tilt UI.
k8s_resource(
    'virtool-jobs-api',
    labels=['virtool'],
    port_forwards=[port_forward(0, 9950)],
    new_name="jobs-api",
    resource_deps=["config", "migration"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    labels=['k8s'],
    new_name='ingress',
    objects=['ingress', 'ingress-uploads'],
    resource_deps=["web"]
)

k8s_resource(
    'virtool-migration',
    labels=['virtool'],
    new_name="migration",
    resource_deps=["azurite", "config", "postgres"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    'virtool-tasks',
    labels=['virtool'],
    new_name="tasks",
    port_forwards=[port_forward(0, 9900)],
    resource_deps=["config", "migration"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    'virtool-web',
    labels=['virtool'],
    new_name="web",
    port_forwards=[port_forward(0, 9900)],
    resource_deps=["config", "postgres"]
)

# Workflows.
k8s_kind(
    'ScaledJob',
    image_json_path='{.spec.jobTargetRef.template.spec.containers[0].image}'
)

k8s_yaml(scoped(kustomize('dev/manifests/workflows')))

for target, image in WORKFLOW_TARGETS:
    if cfg.get(target, False):
        docker_build(image, '.', target=target, ignore=ui_monorepo_ignore)

    k8s_resource(
        'virtool-workflow-' + target,
        labels=["workflows"],
        new_name=target,
        resource_deps=['config', 'jobs-api'],
        trigger_mode=TRIGGER_MODE_MANUAL
    )
