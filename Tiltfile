local(['bash', 'dev/scripts/ensure-minikube.sh'], quiet=False)

# Every live-edit target is a bool flag named after its Dockerfile stage, e.g.
# `tilt up -- --web --jobs-api`. The web target is listed apart because it
# alone runs a dev server rather than the built artifact, so it needs an
# entrypoint and sync rules; see its docker_build below.
WEB_IMAGE = 'ghcr.io/virtool/ui'

SERVICE_TARGETS = [
    ('jobs-api', 'ghcr.io/virtool/jobs-api'),
    ('tasks', 'ghcr.io/virtool/tasks'),
]

# Every workflow is on manual trigger. A ScaledJob's pods are one-shot and only
# start when something claims work, so nothing is waiting on a rebuild — and an
# automatic one would rebuild a large image on every edit. Deploy them from the
# Tilt UI.
#
# All four images publish on release, but `ts-nuvs` has no registry package
# until the first release that carries it and `ts-pathoscope:latest` is a
# tools-only leftover with no workflow code in it, so build those two locally
# meanwhile with `tilt up -- --nuvs`.
WORKFLOW_TARGETS = [
    ('create-sample', 'ghcr.io/virtool/ts-create-sample'),
    ('create-subtraction', 'ghcr.io/virtool/ts-create-subtraction'),
    ('nuvs', 'ghcr.io/virtool/ts-nuvs'),
    ('pathoscope', 'ghcr.io/virtool/ts-pathoscope'),
]

config.define_bool('web', usage='live edit web')

for target, image in SERVICE_TARGETS:
    config.define_bool(target, usage='live edit ' + target)

for target, image in WORKFLOW_TARGETS:
    config.define_bool(target, usage='live edit the ' + target + ' workflow')

cfg = config.parse()

load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://uibutton', 'cmd_button', 'location')

cmd_button('wipe',
    argv=['bash', 'dev/scripts/wipe.sh'],
    icon_name="delete_forever",
    location=location.NAV,
    text='Wipe',
    requires_confirmation=True,
)

helm_repo('kedacore', 'https://kedacore.github.io/charts', labels=['k8s'])

helm_resource(
    'keda',
    'kedacore/keda',
    labels=['k8s'],
    resource_deps=['kedacore'],
    flags=['--version=2.20.2']
)

k8s_yaml('dev/manifests/data/azurite.yaml')
k8s_yaml('dev/manifests/data/postgres.yaml')

k8s_resource("azurite", labels=['data'])
k8s_resource("postgres", labels=['data'])

k8s_yaml('dev/manifests/config.yaml')
k8s_yaml('dev/manifests/ingress.yaml')

# The migration Job runs the published `ghcr.io/virtool/virtool` image and is
# never built here. Migrations are Python's, and the repository that used to
# hold them as a live-edit target no longer exists.
k8s_yaml('dev/manifests/migration.yaml')

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

k8s_yaml(kustomize('dev/manifests/web'))
k8s_yaml(kustomize('dev/manifests/virtool'))

k8s_resource(
    labels=['data'],
    new_name='config',
    objects=['virtool-env:configmap'],
)

k8s_resource(
    'virtool-jobs-api',
    labels=['virtool'],
    port_forwards=["9960:9950"],
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
    resource_deps=["azurite", "postgres"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    'virtool-tasks',
    labels=['virtool'],
    new_name="tasks",
    port_forwards=["9970:9900"],
    resource_deps=["config", "migration"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    'virtool-web',
    labels=['virtool'],
    new_name="web",
    port_forwards=[9900],
    resource_deps=["config", "postgres"]
)

# Workflows.
k8s_kind(
    'ScaledJob',
    image_json_path='{.spec.jobTargetRef.template.spec.containers[0].image}'
)

k8s_yaml(kustomize('dev/manifests/workflows'))

for target, image in WORKFLOW_TARGETS:
    if cfg.get(target, False):
        docker_build(image, '.', target=target, ignore=ui_monorepo_ignore)

    k8s_resource(
        'virtool-workflow-' + target,
        labels=["workflows"],
        new_name=target,
        resource_deps=['config', 'keda', 'jobs-api'],
        trigger_mode=TRIGGER_MODE_MANUAL
    )
