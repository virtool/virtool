# Virtool

## Development

The local Kubernetes development environment uses Tilt on Minikube. Install
the tools listed in [the dev cluster documentation](dev/README.md#requirements),
then run these commands from the repository root:

```shell
mise run init          # one-time cluster setup
mise run up            # bring up this worktree and start Tilt
mise run up:minikube   # start Minikube only
mise run down          # delete this worktree's namespace and data
mise run wipe          # delete this worktree's StatefulSets and PVCs
```

Set `WT` to use a short, memorable namespace slug:

```shell
WT=vir3044 mise run up
```

Arguments after `up` are passed to Tilt, so live-edit targets can be combined:

```shell
mise run up --web --internal
```

See [the dev cluster documentation](dev/README.md) for the architecture,
worktree isolation, manifests, live editing, and data-wiping details.
