local(['bash', 'dev/scripts/ensure-minikube.sh'], quiet=False)

# Every local image target is a bool flag, e.g. `tilt up -- --web --internal`.
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

config.define_bool('web', usage='build web locally')

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

# The migration Job runs the internal image's `migrate` subcommand. It stays a
# separate Job so the long-lived processes only start after schema changes have
# been applied.
k8s_yaml('dev/manifests/migration.yaml')

def image_build(target, image):
    package = '@virtool/' + target
    context = '.docker-build/' + target
    command = 'pnpm --filter ' + package + ' build && ' + \
        'pnpm --filter ' + package + ' --prod deploy ' + context + ' --force && ' + \
        'docker buildx bake -f packages/image-build/docker-bake.hcl ' + target + ' --load --set "' + target + '.tags=$EXPECTED_REF"'
    custom_build(image, command, ['apps/' + target, 'packages', 'pnpm-lock.yaml'])

if cfg.get('web', False):
    image_build('web', WEB_IMAGE)

for target, image in SERVICE_TARGETS:
    if cfg.get(target, False):
        image_build(target, image)

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
    resource_deps=["azurite", "config", "postgres"],
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
        image_build(target, image)

    k8s_resource(
        'virtool-workflow-' + target,
        labels=["workflows"],
        new_name=target,
        resource_deps=['config', 'keda', 'jobs-api'],
        trigger_mode=TRIGGER_MODE_MANUAL
    )
