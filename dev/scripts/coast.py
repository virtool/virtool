#!/usr/bin/env python3
"""Worktree-owned Coast lifecycle. Requires Python 3.11+, Docker, and Coasts 0.1.53."""

import argparse
import base64
import contextlib
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import socket
import ssl
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
import uuid


VERSION = "0.1.53"
AZURE_IMAGE = "mcr.microsoft.com/azure-cli:2.89.1"
AZURE_KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
LIVE_ONLY_SOURCES = ("apps/web/src/", "apps/web/public/", "apps/internal/src/")
WORKFLOW_TARGETS = ("create-sample", "create-subtraction", "pathoscope", "nuvs")
CONFIG_INPUTS = ("Coastfile", "dev/compose.yaml", "dev/Caddyfile", "dev/scripts/init-coast-data.sh")


def run(args, cwd, log=None):
    result = subprocess.run(args, cwd=cwd, text=True, stdout=log or subprocess.PIPE,
                            stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {shlex.join(map(str, args))}"
                           + (f"\n{result.stdout}" if result.stdout else ""))
    return (result.stdout or "").strip()


def git(path, *args):
    return run(["git", *args], path)


def env(key, default=None):
    filename = os.environ.get(f"{key}_FILE")
    return Path(filename).read_text().strip() if filename else os.environ.get(key, default)


def read_json(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


@contextlib.contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def development_dockerfile(root):
    source = (root / "Dockerfile").read_text()
    starts = list(re.finditer(r"(?im)^FROM\s+(\S+)\s+AS\s+(\S+)\s*$", source))
    if len(starts) != len(re.findall(r"(?im)^FROM\s", source)):
        raise RuntimeError("Coasts development builds require named, single-line FROM stages")
    stages = {}
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(source)
        name = match[2].lower()
        if name in stages or "$" in match[1]:
            raise RuntimeError("Coasts development builds require unique stages and literal FROM images")
        stages[name] = (match[1].lower(), source[match.start():end])
    required = set()

    def include(name):
        if name in required or name not in stages:
            return
        required.add(name)
        parent, body = stages[name]
        include(parent)
        if re.search(r"--mount=[^\s]*from=", body):
            raise RuntimeError("Coasts development builds do not support mount dependencies")
        for dependency in re.findall(r"(?i)--from=(\S+)", body):
            if dependency.isdigit() or "$" in dependency:
                raise RuntimeError("Coasts development builds require named COPY dependencies")
            include(dependency.lower())

    if "dev-coast" not in stages:
        raise RuntimeError("Root Dockerfile has no dev-coast stage")
    include("dev-coast")
    return source[:starts[0].start()] + "".join(body for name, (_, body) in stages.items() if name in required)


def prepare_development_dockerfile(root):
    path = root / ".coasts/Dockerfile"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(development_dockerfile(root))


def fingerprint(root, config_only=False):
    paths = set(CONFIG_INPUTS)
    if not config_only:
        candidates = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0")
        for name in candidates:
            if name.startswith(LIVE_ONLY_SOURCES):
                continue
            if (name in ("Dockerfile", ".dockerignore", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "biome.json", "dev/scripts/coast.py")
                    or name.startswith("packages/")
                    or name.startswith(("apps/create-sample/", "apps/create-subtraction/",
                                        "apps/pathoscope/", "apps/nuvs/"))
                    or name.startswith("apps/internal/")
                    or name.startswith("apps/web/") and not name.startswith(("apps/web/src/", "apps/web/public/"))
                    or re.fullmatch(r"apps/[^/]+/package.json", name)
                    or name == "apps/tsconfig.node.json"):
                paths.add(name)
    digest = hashlib.sha256()
    for name in sorted(paths):
        path = root / name
        digest.update(name.encode() + b"\0")
        digest.update(path.read_bytes() if path.is_file() else b"missing")
    return digest.hexdigest()


def validate_assignment(primary, worktree, branch):
    # Coast 0.1.53 interpolates these into unquoted shell commands when assigning.
    for value in (str(primary), str(worktree), branch):
        if not re.fullmatch(r"[A-Za-z0-9_./+-]+", value):
            raise RuntimeError("Coasts 0.1.53 requires paths and branch names containing only letters, numbers, /, _, ., +, and -. Move worktrees out of paths with spaces before assigning them.")


def worktree_key(worktree, registry, create=False):
    git_dir = Path(git(worktree, "rev-parse", "--absolute-git-dir"))
    marker = git_dir / "virtool-coast-key"
    if not create:
        return marker.read_text().strip() if marker.exists() else None
    with lock(registry / "identity.lock"):
        if not marker.exists():
            marker.write_text(uuid.uuid4().hex + "\n")
        key = marker.read_text().strip()
        if not re.fullmatch(r"[0-9a-f]{24,32}", key):
            raise RuntimeError(f"Invalid Coast identity in {marker}")
        return key


class Coast:
    def __init__(self, root, project, log=None):
        self.root = root
        self.project = project
        self.log = log
        self.binary = env("VT_COAST_BIN") or shutil.which("coast") or str(Path.home() / ".coast/bin/coast")
        self.api_url = env("VT_COAST_API", "http://127.0.0.1:31415")
        parsed = urllib.parse.urlparse(self.api_url)
        if parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise RuntimeError("VT_COAST_API must be a local HTTP address")

    def check(self):
        if run([self.binary, "--version"], self.root) != f"coast {VERSION}":
            raise RuntimeError(f"This integration requires Coasts {VERSION}")
        run(["docker", "info", "--format", "{{.ServerVersion}}"], self.root)
        self.api("/ls")

    def api(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.api_url + "/api/v1" + path, data=data,
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except (urllib.error.URLError, ValueError) as error:
            raise RuntimeError(f"Coast API failed: {error}. Check `coast daemon start` and VT_COAST_API.") from error

    def command(self, *args):
        label = shlex.join(args)
        print(f"coast {label[:140]}{'…' if len(label) > 140 else ''}", flush=True)
        if self.log:
            print(f"coast {label}", file=self.log, flush=True)
        return run([self.binary, "--project", self.project, "--working-dir", str(self.root), *args], self.root, self.log)

    def instances(self):
        result = self.api("/ls")
        for project in result["known_projects"]:
            if project["name"] == self.project and Path(project["project_root"]).resolve() != self.root:
                raise RuntimeError(f"Coast project {self.project} belongs to another checkout: {project['project_root']}")
        return {item["name"]: item for item in result["instances"] if item["project"] == self.project}

    def ports(self, name):
        return self.api("/ports", {"action": "List", "project": self.project, "name": name})["ports"]

    def latest_build(self):
        builds = self.api("/builds?" + urllib.parse.urlencode({"project": self.project}))["builds"]
        return next((build["build_id"] for build in builds if build["is_latest"]), None)

    def configure_links(self):
        for key, value in ((f"subdomain_routing:{self.project}", "true"),
                           (f"port_url:{self.project}:https", "https://localhost:<port>")):
            current = self.api("/settings?" + urllib.parse.urlencode({"key": key}))
            if current.get("value") != value:
                self.api("/settings", {"key": key, "value": value})

    def clear_url(self, record):
        run(["wt", "config", "state", "vars", "clear", "coasturl", "--branch", record["branch"]], self.root, self.log)

    def certificate(self, name):
        output = run([self.binary, "--project", self.project, "docker", "--root", name,
                      "compose", "exec", "-T", "proxy", "cat",
                      "/data/caddy/pki/authorities/local/root.crt"], self.root)
        match = re.search(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", output, re.DOTALL)
        if not match:
            raise RuntimeError("The Coast proxy has not generated its root certificate yet")
        return match[0] + "\n"

    def compose(self, name, *args):
        return self.command("docker", "--root", name, "compose", *args)

    def is_running(self, name):
        return run(["docker", "inspect", "--format", "{{.State.Running}}",
                    f"{self.project}-coasts-{name}"], self.root) == "true"

    def shared_services(self):
        return tomllib.loads((self.root / "Coastfile").read_text()).get("shared_services", {})

    def check_shared_services(self):
        configured = self.shared_services()
        if not configured:
            return
        registered = {service["name"] for service in self.api(
            "/shared/ls?" + urllib.parse.urlencode({"project": self.project}))["services"]}
        missing = configured.keys() - registered
        if missing:
            raise RuntimeError(f"Shared services are not registered in Coast: {', '.join(sorted(missing))}. Restore them through Coast provisioning before retrying; `shared-services start` cannot recreate them. See dev/README.md#shared-service-recovery.")
        for service in configured:
            container = f"{self.project}-shared-services-{service}"
            inspected = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                                       text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if inspected.returncode:
                raise RuntimeError(f"Cannot inspect shared service {service!r}: {inspected.stderr.strip()}. Restore the shared container before retrying. See dev/README.md#shared-service-recovery.")
            if inspected.stdout.strip() != "true":
                self.command("shared-services", "start", service)
                if run(["docker", "inspect", "--format", "{{.State.Running}}", container], self.root) != "true":
                    raise RuntimeError(f"Shared service {service!r} did not start; inspect its Docker logs before retrying")

    def has_shared_service_proxies(self, name):
        configured = self.shared_services()
        if not configured:
            return True
        configuration = json.loads(run([self.binary, "--project", self.project, "docker", "--root", name,
                                        "compose", "config", "--format", "json"], self.root))
        targets = set()
        for service, settings in configured.items():
            addresses = set()
            for inner in configuration["services"].values():
                hosts = inner.get("extra_hosts", [])
                if isinstance(hosts, list):
                    hosts = dict(host.split("=" if "=" in host else ":", 1) for host in hosts)
                if service in hosts:
                    addresses.add(hosts[service])
            if not addresses:
                return False
            for port in settings.get("ports", []):
                targets.update((address, str(port).split(":")[-1]) for address in addresses)
        if not targets:
            return True
        script = "\n".join(shlex.join(["nc", "-z", "-w", "2", address, port])
                           for address, port in sorted(targets))
        result = subprocess.run(["docker", "exec", f"{self.project}-coasts-{name}", "sh", "-ec", script],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.returncode == 0

    def check_resume_ports(self, name):
        for mapping in self.ports(name):
            port = mapping["dynamic_port"]
            with socket.socket() as listener:
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    listener.bind(("0.0.0.0", port))
                except OSError as error:
                    raise RuntimeError(f"Cannot resume {name}: reserved host port {port} is unavailable. Release it and retry ensure; the instance URL and data are unchanged.") from error

    def restore_bridge(self, name):
        outer = f"{self.project}-coasts-{name}"
        configuration = json.loads(run(["docker", "inspect", outer], self.root))[0]
        if (configuration["HostConfig"]["NetworkMode"] == "bridge"
                and "bridge" not in configuration["NetworkSettings"]["Networks"]):
            run(["docker", "network", "connect", "bridge", outer], self.root, self.log)

    def resume(self, name, status):
        if not self.is_running(name):
            self.check_resume_ports(name)
            if status != "stopped":
                self.command("stop", name)
            self.restore_bridge(name)
            outer = f"{self.project}-coasts-{name}"
            run(["docker", "start", outer], self.root, self.log)
            run(["docker", "exec", outer, "sh", "-ec",
                 "rm -f /var/run/coast/shared-service-proxies/*.pid"], self.root, self.log)
        self.command("start", name)
        if not self.is_running(name):
            raise RuntimeError(f"Coast reported startup success but {name}'s outer container exited; inspect docker logs and retry ensure")

    def check_worktree(self, record):
        branch = run(["docker", "exec", f"{self.project}-coasts-{record['name']}",
                      "git", "-c", "safe.directory=/workspace", "-C", "/workspace",
                      "symbolic-ref", "--short", "HEAD"], self.root)
        if branch != record["branch"]:
            raise RuntimeError(f"Coast mounted branch {branch!r}, expected {record['branch']!r}; refusing to start services")

    def configure(self, record):
        values = {
            "Caddyfile": (self.root / "dev/Caddyfile").read_text(),
            "init-coast-data.sh": (self.root / "dev/scripts/init-coast-data.sh").read_text(),
            "namespace": record["data_id"],
            "public-origin": record["url"],
            "hostname": record["hostname"],
            "instance": json.dumps({key: record[key] for key in ("name", "branch", "worktree", "url")}),
        }
        commands = []
        for filename, value in values.items():
            encoded = base64.b64encode((value + "\n").encode()).decode()
            commands.append(f"printf %s {encoded} | base64 -d > /run/virtool-dev/{filename}")
        self.compose(record["name"], "run", "--rm", "--no-deps", "-T", "--entrypoint", "sh", "database-init", "-ec", "; ".join(commands))

    def rebuild(self, record, source_hash):
        configuration = json.loads(run([self.binary, "--project", self.project, "docker", "--root",
                                       record["name"], "compose", "config", "--format", "json"], self.root))
        images = [("dev-coast", ".coasts/Dockerfile", ("web", "migration", "jobs-api", "tasks")),
                  *((target, "Dockerfile", (f"workflow-{target}",)) for target in WORKFLOW_TARGETS)]
        replacements = []
        for target, dockerfile, services in images:
            image_id = self.load_image(record, source_hash, target, dockerfile)
            replacements.extend((service, image_id) for service in services)
        for service, image_id in replacements:
            self.command("docker", "--root", record["name"], "tag", image_id, configuration["services"][service]["image"])
        workflows = tuple(f"workflow-{target}" for target in WORKFLOW_TARGETS)
        self.compose(record["name"], "stop", *workflows, "proxy", "web", "jobs-api", "tasks")
        self.compose(record["name"], "up", "-d", "--force-recreate", "migration", "web", "jobs-api", "tasks", "proxy", *workflows)

    def load_image(self, record, source_hash, target, dockerfile):
        worktree = Path(record["worktree"])
        tag = f"virtool-worktree/{target}:{source_hash}"
        cached = subprocess.run(["docker", "image", "inspect", tag], stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL).returncode == 0
        if not cached:
            if target == "dev-coast":
                prepare_development_dockerfile(worktree)
            run(["docker", "build", "-f", dockerfile, "--target", target,
                 "-t", tag, "."], worktree, self.log)
        outer = f"{self.project}-coasts-{record['name']}"
        image_id = run(["docker", "image", "inspect", "--format", "{{.Id}}", tag], worktree)
        present = subprocess.run(["docker", "exec", outer, "docker", "image", "inspect",
                                  "--format", "{{.Id}}", image_id], text=True,
                                 stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if present.returncode or present.stdout.strip() != image_id:
            with subprocess.Popen(["docker", "save", tag], stdout=subprocess.PIPE, stderr=self.log) as save:
                loaded = subprocess.run(["docker", "exec", "-i", outer, "docker", "load"],
                                        stdin=save.stdout, stdout=self.log, stderr=self.log)
                save.stdout.close()
                if save.wait() or loaded.returncode:
                    raise RuntimeError("Failed to load worktree images into Coast")
        return image_id

    def delete_data(self, record):
        data_id = record["data_id"]
        if not re.fullmatch(r"vt[0-9a-f]{32}", data_id):
            raise RuntimeError("Invalid data identity; refusing deletion")
        run(["docker", "exec", f"{self.project}-shared-services-postgres", "psql", "--no-psqlrc",
             "-U", "virtool", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
             f'DROP DATABASE IF EXISTS "{data_id}" WITH (FORCE)'], self.root, self.log)
        connection = ("DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;"
                      f"AccountKey={AZURE_KEY};BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;")
        run(["docker", "run", "--rm", "--network", f"container:{self.project}-shared-services-azurite",
             AZURE_IMAGE, "az", "storage", "container", "delete", "--name", data_id,
             "--connection-string", connection, "--output", "none"], self.root, self.log)

    def ready(self, record):
        if not self.is_running(record["name"]):
            return False
        services = self.api("/ps", {"project": self.project, "name": record["name"]})["services"]
        running = {service["name"] for service in services if service["status"] == "running"}
        if not {"web", "jobs-api", "tasks", "proxy"}.issubset(running):
            return False
        # Watchers stay alive after a failed build, so container state is insufficient.
        try:
            run([self.binary, "--project", self.project, "docker", "--root", record["name"],
                 "compose", "exec", "-T", "web", "node", "-e",
                 "Promise.all(['http://jobs-api:9950','http://tasks:9900'].map(async url => {"
                 "const response = await fetch(url + '/health/ready', {signal: AbortSignal.timeout(2000)});"
                 "if (!response.ok) throw new Error('Service is not ready');"
                 "})).catch(() => process.exit(1))"], self.root)
        except RuntimeError:
            return False
        port = urllib.parse.urlparse(record["url"]).port
        try:
            context = ssl.create_default_context(cadata=self.certificate(record["name"]))
            with socket.create_connection(("127.0.0.1", port), timeout=5) as connection:
                with context.wrap_socket(connection, server_hostname=record["hostname"]) as secure:
                    secure.sendall(f"GET /health/ready HTTP/1.1\r\nHost: {record['hostname']}:{port}\r\nConnection: close\r\n\r\n".encode())
                    response = http.client.HTTPResponse(secure)
                    response.begin()
                    return response.status == 200
        except (OSError, RuntimeError, http.client.HTTPException):
            return False


class Lifecycle:
    def __init__(self, registry, coast):
        self.registry = registry
        self.coast = coast

    def save(self, key, record):
        write_json(self.registry / "instances" / f"{key}.json", record)
        self.publish_instances()

    def publish_instances(self):
        with lock(self.registry / "discovery.lock"):
            active = []
            for path in sorted((self.registry / "instances").glob("*.json")):
                record = read_json(path)
                try:
                    if worktree_key(Path(record["worktree"]), self.registry) == record["key"]:
                        active.append(record)
                except (OSError, RuntimeError, KeyError):
                    continue
            listing = [{key: record[key] for key in ("name", "branch", "url", "state")}
                       for record in active if record.get("url")]
            for record in active:
                directory = Path(record["worktree"]) / "apps/web/src"
                if (directory / "app/DevelopmentInstance.tsx").is_file():
                    write_json(directory / ".dev-instances.json", listing)

    def build(self, primary):
        build_hash = fingerprint(primary)
        build = read_json(self.registry / "build.json", {})
        if build.get("hash") != build_hash or build.get("id") != self.coast.latest_build():
            prepare_development_dockerfile(primary)
            self.coast.command("build")
            write_json(self.registry / "build.json", {"hash": build_hash, "id": self.coast.latest_build()})
        return build_hash

    def ensure(self, key, worktree, branch, primary, rebuild=False):
        validate_assignment(primary, worktree, branch)
        path = self.registry / "instances" / f"{key}.json"
        record = read_json(path)
        if record and record["state"] == "removing":
            raise RuntimeError(f"Cleanup is pending for {record['name']}; retry remove before starting it")
        instances = self.coast.instances()
        if record is None:
            suffix = uuid.uuid4().hex
            slug = re.sub(r"[^a-z0-9]+", "-", branch.lower()).strip("-")[:28] or "worktree"
            name = f"{slug}-{suffix[:10]}"
            if name in instances:
                raise RuntimeError(f"Coast name collision: {name}; retry")
            record = {"name": name, "data_id": "vt" + suffix, "state": "starting", "key": key}
        changed_identity = record.get("branch") != branch or record.get("worktree") != str(worktree)
        record.update(branch=branch, worktree=str(worktree), hostname=f"{record['name']}.localhost")
        self.save(key, record)
        source_hash = fingerprint(worktree)
        config_hash = fingerprint(worktree, True)
        if config_hash != fingerprint(primary, True):
            raise RuntimeError("Worktree development configuration differs from the primary worktree. Update both before starting Coasts.")
        if record.get("config_hash", config_hash) != config_hash:
            raise RuntimeError("Coast configuration changed. Remove this instance and ensure it again to apply it with fresh data.")
        record["config_hash"] = config_hash
        self.save(key, record)
        instance = instances.get(record["name"])
        if instance is not None:
            self.coast.check_shared_services()
        if (instance and instance["status"] in ("running", "checked_out")
                and instance.get("worktree") == (branch if worktree != primary else None)
                and not changed_identity and not rebuild
                and record.get("build_hash") == source_hash and self.coast.ready(record)
                and self.coast.has_shared_service_proxies(record["name"])):
            self.coast.check_worktree(record)
            record["state"] = "ready"
            record.pop("error", None)
            self.save(key, record)
            return record
        if instance is None:
            if record.get("provisioned"):
                raise RuntimeError("Coast was removed outside the lifecycle script. Run remove to clean its data before recreating it.")
            with lock(self.registry / "build.lock"):
                build_hash = self.build(primary)
                self.coast.command("run", record["name"])
            instance = self.coast.instances().get(record["name"])
            if instance is None:
                raise RuntimeError("Coast did not create the requested instance")
            record["provisioned"] = True
            record["image_hash"] = build_hash
            self.save(key, record)
            self.coast.check_shared_services()
        if instance["status"] == "stopped" or not self.coast.is_running(record["name"]):
            self.coast.resume(record["name"], instance["status"])
            instance = self.coast.instances()[record["name"]]
        if not self.coast.has_shared_service_proxies(record["name"]):
            self.coast.command("stop", record["name"])
            self.coast.resume(record["name"], "stopped")
            instance = self.coast.instances()[record["name"]]
            if not self.coast.has_shared_service_proxies(record["name"]):
                raise RuntimeError("Coast restarted but shared-service proxies are still unreachable; inspect Coast's shared-service proxy logs before retrying")
        ports = self.coast.ports(record["name"])
        port = next(port["dynamic_port"] for port in ports if port["logical_name"] == "https")
        record["url"] = f"https://{record['hostname']}:{port}"
        record["state"] = "starting"
        self.save(key, record)
        needs_build = rebuild or record.get("build_hash") != source_hash
        if changed_identity or needs_build:
            self.coast.configure(record)
        if worktree != primary and instance.get("worktree") != branch:
            self.coast.command("assign", record["name"], "--worktree", branch)
            assigned = self.coast.instances()[record["name"]]
            if assigned.get("worktree") != branch:
                raise RuntimeError("Coast worktree assignment failed; see the Coast logs")
        elif worktree == primary and instance.get("worktree") is not None:
            self.coast.command("unassign", record["name"])
        self.coast.check_worktree(record)
        if rebuild or record.get("image_hash") != source_hash:
            with lock(self.registry / "build.lock"):
                self.coast.rebuild(record, source_hash)
            record["image_hash"] = source_hash
            self.save(key, record)
        if worktree == primary and instance["status"] == "idle":
            self.coast.command("start", record["name"])
        if changed_identity and not needs_build:
            self.coast.compose(record["name"], "restart", "web")
        self.coast.compose(record["name"], "up", "-d")
        deadline = time.monotonic() + 180
        while not self.coast.ready(record):
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Readiness timed out for {record['name']}; retry ensure after checking logs")
            time.sleep(2)
        record.update(state="ready", build_hash=source_hash, config_hash=config_hash)
        (self.registry / "root.crt").write_text(self.coast.certificate(record["name"]))
        record.pop("error", None)
        self.save(key, record)
        return record

    def remove(self, key):
        path = self.registry / "instances" / f"{key}.json"
        record = read_json(path)
        if record is None:
            print("No managed Coast for this worktree")
            return
        record["state"] = "removing"
        self.save(key, record)
        instance = self.coast.instances().get(record["name"])
        if instance is not None and instance["status"] != "stopped":
            self.coast.command("stop", record["name"])
            if self.coast.instances()[record["name"]]["status"] != "stopped":
                raise RuntimeError("Coast did not stop; refusing to delete data while writers may be active")
        if instance is not None or record.get("provisioned"):
            self.coast.delete_data(record)
        if instance is not None:
            self.coast.command("rm", record["name"])
        self.coast.clear_url(record)
        path.unlink()
        self.publish_instances()
        print(f"Removed {record['name']}, its database, and its blobs")


def main():
    parser = argparse.ArgumentParser(prog="coasts", description=__doc__)
    parser.add_argument("command", choices=("up", "status", "list", "stop", "remove"))
    parser.add_argument("--worktree", type=Path, default=Path.cwd())
    parser.add_argument("--instance", help="Registry instance name, including one whose worktree is gone")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild an existing instance")
    args = parser.parse_args()
    worktree = args.worktree.resolve()
    common = Path(git(Path.cwd(), "rev-parse", "--path-format=absolute", "--git-common-dir"))
    primary = Path(git(Path.cwd(), "worktree", "list", "--porcelain", "-z").split("\0")[0].removeprefix("worktree "))
    registry = common / "virtool-coasts"
    records = list((registry / "instances").glob("*.json"))
    if args.command == "list":
        for path in records:
            record = read_json(path)
            try:
                active_key = worktree_key(Path(record["worktree"]), registry)
            except (OSError, RuntimeError):
                active_key = None
            state = record["state"] if active_key == record["key"] else "orphaned"
            print(f"{record['name']}\t{state}\t{record['worktree']}\t{record.get('url', '')}")
        return
    if args.instance:
        matching = [path for path in records if read_json(path)["name"] == args.instance]
        if len(matching) != 1:
            raise RuntimeError(f"No registered instance named {args.instance}")
        key = matching[0].stem
        worktree = Path(read_json(matching[0])["worktree"])
    else:
        key = worktree_key(worktree, registry, create=args.command == "up")
        if key is None:
            print("No managed Coast for this worktree")
            return
    path = registry / "instances" / f"{key}.json"
    if args.command == "status":
        print(json.dumps(read_json(path, {"state": "absent"}), indent=2))
        print(f"Logs: {registry / 'logs' / (key + '.log')}")
        return
    with lock(registry / "locks" / f"{key}.lock"):
        log_path = registry / "logs" / f"{key}.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Logs: {log_path}", flush=True)
        with log_path.open("w") as log:
            config = tomllib.loads((primary / "Coastfile").read_text())
            coast = Coast(primary, config["coast"]["name"], log)
            lifecycle = Lifecycle(registry, coast)
            try:
                if args.command == "remove" and not path.exists():
                    print("No managed Coast for this worktree")
                    return
                coast.check()
                if args.command == "up":
                    branch = git(worktree, "symbolic-ref", "--short", "HEAD")
                    record = lifecycle.ensure(key, worktree, branch, primary, args.rebuild)
                    coast.configure_links()
                    run(["wt", "config", "state", "vars", "set", f"coasturl={record['url']}"], worktree, log)
                    print(f"Ready: {record['url']}")
                elif args.command == "remove":
                    lifecycle.remove(key)
                elif args.command == "stop":
                    record = read_json(path)
                    if record:
                        coast.command("stop", record["name"])
                        if record["state"] != "removing":
                            record["state"] = "stopped"
                        lifecycle.save(key, record)
            except Exception as error:
                record = read_json(path)
                if record:
                    if record["state"] != "removing":
                        record["state"] = "failed"
                    record["error"] = str(error)
                    lifecycle.save(key, record)
                print(str(error), file=log)
                raise RuntimeError(f"{error}\nLogs: {log_path}\nRetry: coasts {args.command}") from error


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
