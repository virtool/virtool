local(['bash', 'dev/scripts/ensure-minikube.sh'], quiet=False)

# Configuration
#
# Each live-edit target is a bool flag with a long and short form (e.g.
# `--web` / `-w`). Tilt's flag parser only matches on the exact name given to
# config.define_bool, so the short form has to be defined and checked
# separately.
config.define_bool("web", usage="live edit the web app")
config.define_bool("w")
config.define_bool("jobs-api", usage="live edit jobs-api")
config.define_bool("j")
config.define_bool("tasks", usage="live edit tasks")
config.define_bool("t")
config.define_bool("create-sample", usage="live edit the create-sample workflow")
config.define_bool("m")
config.define_bool("create-subtraction", usage="live edit the create-subtraction workflow")
config.define_bool("b")
config.define_bool("nuvs", usage="live edit the nuvs workflow")
config.define_bool("n")
config.define_bool("pathoscope", usage="live edit the pathoscope workflow")
config.define_bool("p")

cfg = config.parse()

def flag(long, short=None):
    return cfg.get(long, False) or (short != None and cfg.get(short, False))

edit_web = flag("web", "w")
edit_jobs_api = flag("jobs-api", "j")
edit_tasks = flag("tasks", "t")
edit_create_sample = flag("create-sample", "m")
edit_create_subtraction = flag("create-subtraction", "b")
edit_nuvs = flag("nuvs", "n")
edit_pathoscope = flag("pathoscope", "p")

load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://uibutton', 'cmd_button', 'location')

cmd_button('pull',
    argv=['bash', 'dev/scripts/pull.sh'],
    icon_name="cloud_download",
    location=location.NAV,
    text='Pull',
)

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
    resource_deps=['kedacore']
)

k8s_yaml('dev/manifests/data/azurite.yaml')
k8s_yaml('dev/manifests/data/postgres.yaml')

k8s_resource("azurite", labels=['data'])
k8s_resource("postgres", labels=['data'])

# The migration Job runs the published `ghcr.io/virtool/virtool` image and is
# never built here. Migrations are Python's, and the repository that used to
# hold them as a live-edit target no longer exists.
k8s_yaml('dev/manifests/ingress.yaml')
k8s_yaml('dev/manifests/migration.yaml')

docker_prune_settings(max_age_mins=1)

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

# Actual Virtool stuff.
if edit_web:
    docker_build(
      'ghcr.io/virtool/ui',
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

if edit_jobs_api:
    docker_build(
      'ghcr.io/virtool/jobs-api',
      '.',
      target='jobs-api',
      ignore=ui_monorepo_ignore,
    )

if edit_tasks:
    docker_build(
      'ghcr.io/virtool/tasks',
      '.',
      target='tasks',
      ignore=ui_monorepo_ignore,
    )

k8s_yaml(kustomize('dev/manifests/web'))
k8s_yaml(kustomize('dev/manifests/virtool'))

k8s_resource(
    'virtool-jobs-api',
    labels=['virtool'],
    port_forwards=["9960:9950"],
    new_name="jobs-api",
    resource_deps=["migration"],
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
    resource_deps=["migration"],
    trigger_mode=TRIGGER_MODE_MANUAL
)

k8s_resource(
    'virtool-web',
    labels=['virtool'],
    new_name="web",
    port_forwards=[9900],
    resource_deps=["postgres"]
)

"""Workflows"""
if edit_create_sample:
    docker_build(
        'ghcr.io/virtool/create-sample',
        '.',
        target='create-sample',
        ignore=ui_monorepo_ignore,
    )

if edit_create_subtraction:
    docker_build(
        'ghcr.io/virtool/create-subtraction',
        '.',
        target='create-subtraction',
        ignore=ui_monorepo_ignore,
    )

if edit_nuvs:
    docker_build(
        'ghcr.io/virtool/nuvs',
        '.',
        target='nuvs',
        ignore=ui_monorepo_ignore,
    )

if edit_pathoscope:
    docker_build(
        'ghcr.io/virtool/pathoscope',
        '.',
        target='pathoscope',
        ignore=ui_monorepo_ignore,
    )

k8s_kind(
    'ScaledJob',
    image_json_path='{.spec.jobTargetRef.template.spec.containers[0].image}'
)

k8s_yaml(kustomize('dev/manifests/workflows'))

scaled_job_deps = ['keda', 'jobs-api']

k8s_resource(
    'virtool-workflow-create-sample',
    labels=["workflows"],
    new_name="create-sample",
    resource_deps=scaled_job_deps
)


k8s_resource(
    'virtool-workflow-create-subtraction',
    labels=["workflows"],
    new_name="create-subtraction",
    resource_deps=scaled_job_deps
)



k8s_resource(
    'virtool-workflow-nuvs',
    labels=["workflows"],
    new_name="nuvs",
    resource_deps=scaled_job_deps
)

k8s_resource(
    'virtool-workflow-pathoscope',
    labels=["workflows"],
    new_name="pathoscope",
    resource_deps=scaled_job_deps,
    trigger_mode=TRIGGER_MODE_MANUAL
)
