import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import shutil
import subprocess
import json
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("coast", Path(__file__).with_name("coast.py"))
coast = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coast)


class FakeCoast:
    def __init__(self):
        self.items = {}
        self.events = []
        self.databases = set()
        self.blobs = set()
        self.fail_delete = False
        self.fail_start = False
        self.fail_stop = False
        self.fail_assign = False

    def instances(self):
        return self.items.copy()

    def latest_build(self):
        return "build-id"

    def certificate(self, name):
        return "test certificate"

    def is_running(self, name):
        return self.items[name]["status"] != "stopped"

    def resume(self, name, status):
        self.command("start", name)

    def clear_url(self, record):
        self.events.append(("clear_url", record["name"]))

    def command(self, *args):
        self.events.append(args)
        action = args[0]
        if action == "run":
            self.items[args[1]] = {"status": "idle", "worktree": None}
        elif action == "start":
            if self.fail_start:
                raise RuntimeError("start failed")
            self.items[args[1]]["status"] = "running"
        elif action == "stop":
            if not self.fail_stop:
                self.items[args[1]]["status"] = "stopped"
        elif action == "rm":
            del self.items[args[1]]
        elif action == "assign" and not self.fail_assign:
            self.items[args[1]]["worktree"] = args[3]
        elif action == "unassign":
            self.items[args[1]]["worktree"] = None

    def ports(self, name):
        return [{"logical_name": "https", "dynamic_port": 50000}]

    def configure(self, record):
        self.events.append(("configure", record["name"]))
        self.databases.add(record["data_id"])
        self.blobs.add(record["data_id"])

    def check_worktree(self, record):
        pass

    def compose(self, name, *args):
        self.events.append(("compose", name, *args))
        if args == ("up", "-d"):
            self.items[name]["status"] = "running"

    def delete_data(self, record):
        self.events.append(("delete_data", record["name"]))
        self.databases.discard(record["data_id"])
        if self.fail_delete:
            raise RuntimeError("blob deletion failed")
        self.blobs.discard(record["data_id"])

    def ready(self, record):
        return True

    def rebuild(self, record, source_hash):
        self.events.append(("rebuild", record["name"]))


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "Dockerfile").write_text("FROM node:24 AS dev-coast\n")
        self.backend = FakeCoast()
        self.lifecycle = coast.Lifecycle(self.root / "registry", self.backend)
        self.hash = patch.object(coast, "fingerprint", return_value="hash")
        self.hash.start()
        self.addCleanup(self.hash.stop)

    def ensure(self, key="first", branch="feature/first", worktree=None):
        return self.lifecycle.ensure(key, worktree or self.root / key, branch, self.root)

    def record(self, key="first"):
        return coast.read_json(self.root / "registry/instances" / f"{key}.json")

    def test_switching_twice_keeps_identity_and_does_not_rebuild(self):
        first = self.ensure()
        self.backend.events.clear()
        second = self.ensure()
        self.assertEqual(first["data_id"], second["data_id"])
        self.assertEqual(first["url"], second["url"])
        self.assertFalse(any(event[0] in ("build", "rebuild", "run", "assign", "configure")
                             for event in self.backend.events))

    def test_stop_resume_preserves_data(self):
        first = self.ensure()
        self.backend.command("stop", first["name"])
        second = self.ensure()
        self.assertEqual(first["data_id"], second["data_id"])
        self.assertIn(first["data_id"], self.backend.databases)
        self.assertIn(first["data_id"], self.backend.blobs)
        self.assertIn(("start", first["name"]), self.backend.events)

    def test_stale_running_status_resumes_without_recreating_data(self):
        first = self.ensure()
        with patch.object(self.backend, "ready", side_effect=[False, True]), \
                patch.object(self.backend, "is_running", return_value=False), \
                patch.object(self.backend, "resume") as resume:
            second = self.ensure()
        resume.assert_called_once_with(first["name"], "running")
        self.assertEqual(second["data_id"], first["data_id"])

    def test_resume_clears_previous_boot_proxy_pids_before_coast_start(self):
        backend = coast.Coast(self.root, "virtool")
        with patch.object(backend, "is_running", side_effect=[False, True]), \
                patch.object(backend, "check_resume_ports"), \
                patch.object(backend, "restore_bridge"), \
                patch.object(coast, "run", return_value="") as command:
            backend.resume("secondary", "running")
        calls = [call.args[0] for call in command.call_args_list]
        self.assertEqual(calls[0][-2:], ["stop", "secondary"])
        self.assertEqual(calls[1], ["docker", "start", "virtool-coasts-secondary"])
        self.assertIn("shared-service-proxies/*.pid", calls[2][-1])
        self.assertEqual(calls[3][-2:], ["start", "secondary"])

    def test_resume_rejects_false_success(self):
        backend = coast.Coast(self.root, "virtool")
        with patch.object(backend, "is_running", return_value=False), \
                patch.object(backend, "check_resume_ports"), \
                patch.object(backend, "restore_bridge"), \
                patch.object(coast, "run", return_value=""):
            with self.assertRaisesRegex(RuntimeError, "outer container exited"):
                backend.resume("secondary", "stopped")

    def test_occupied_port_fails_before_starting_or_changing_networks(self):
        backend = coast.Coast(self.root, "virtool")
        with coast.socket.socket() as listener:
            listener.bind(("0.0.0.0", 0))
            listener.listen()
            port = listener.getsockname()[1]
            with patch.object(backend, "ports", return_value=[{"dynamic_port": port}]), \
                    patch.object(backend, "is_running", return_value=False), \
                    patch.object(coast, "run") as command:
                with self.assertRaisesRegex(RuntimeError, f"reserved host port {port}"):
                    backend.resume("secondary", "stopped")
            command.assert_not_called()

    def test_missing_bridge_is_restored_without_touching_shared_networks(self):
        backend = coast.Coast(self.root, "virtool")
        configuration = [{"HostConfig": {"NetworkMode": "bridge"},
                          "NetworkSettings": {"Networks": {"coast-shared-virtool": {}}}}]
        with patch.object(coast, "run", return_value=coast.json.dumps(configuration)) as command:
            backend.restore_bridge("secondary")
        self.assertEqual(command.call_args_list[-1].args[0],
                         ["docker", "network", "connect", "bridge", "virtool-coasts-secondary"])

    def test_discovery_excludes_orphans_and_private_data_and_tracks_removal(self):
        first = self.ensure()
        second = self.ensure("second", "feature/second")
        directory = Path(first["worktree"]) / "apps/web/src"
        marker = directory / "app/DevelopmentInstance.tsx"
        marker.parent.mkdir(parents=True)
        marker.touch()
        with patch.object(coast, "worktree_key", side_effect=["first", None]):
            self.lifecycle.publish_instances()
        self.assertEqual(coast.read_json(directory / ".dev-instances.json"), [
            {key: first[key] for key in ("name", "branch", "url", "state")}
        ])
        with patch.object(coast, "worktree_key", return_value="first"):
            self.lifecycle.remove("second")
        self.assertNotIn(second["name"], (directory / ".dev-instances.json").read_text())

    def test_primary_starts_provisioned_images_without_rebuilding_idle_instance(self):
        record = self.ensure(worktree=self.root)
        self.assertIn(("start", record["name"]), self.backend.events)
        self.assertNotIn(("rebuild", record["name"]), self.backend.events)

    def test_remove_deletes_only_its_own_data_and_recreation_is_fresh(self):
        first = self.ensure()
        second = self.ensure("second", "feature/second")
        self.lifecycle.remove("first")
        self.assertIsNone(self.record())
        self.assertNotIn(first["name"], self.backend.items)
        self.assertEqual(self.backend.databases, {second["data_id"]})
        self.assertEqual(self.backend.blobs, {second["data_id"]})
        recreated = self.ensure()
        self.assertNotEqual(first["data_id"], recreated["data_id"])
        self.assertNotEqual(first["name"], recreated["name"])

    def test_partial_deletion_blocks_startup_and_can_be_retried(self):
        record = self.ensure()
        self.backend.fail_delete = True
        with self.assertRaisesRegex(RuntimeError, "blob deletion"):
            self.lifecycle.remove("first")
        self.assertEqual(self.record()["state"], "removing")
        self.assertNotIn(record["data_id"], self.backend.databases)
        self.assertIn(record["data_id"], self.backend.blobs)
        with self.assertRaisesRegex(RuntimeError, "Cleanup is pending"):
            self.ensure()
        self.backend.fail_delete = False
        self.lifecycle.remove("first")
        self.assertFalse(self.backend.blobs)
        self.assertIsNone(self.record())

    def test_failed_stop_does_not_delete_data(self):
        record = self.ensure()
        self.backend.fail_stop = True
        with self.assertRaisesRegex(RuntimeError, "did not stop"):
            self.lifecycle.remove("first")
        self.assertIn(record["data_id"], self.backend.databases)
        self.assertIn(record["data_id"], self.backend.blobs)

    def test_branch_rename_and_worktree_move_preserve_identity(self):
        first = self.ensure()
        renamed = self.ensure(branch="new/name", worktree=self.root / "moved-directory")
        self.assertEqual(first["name"], renamed["name"])
        self.assertEqual(first["data_id"], renamed["data_id"])
        self.assertEqual(renamed["branch"], "new/name")

    def test_unsafe_coast_paths_fail_before_provisioning(self):
        with self.assertRaisesRegex(RuntimeError, "paths with spaces"):
            self.ensure(worktree=self.root / "directory with spaces")
        with self.assertRaises(RuntimeError):
            self.ensure(branch="feature/$(touch-test)")
        self.assertFalse(self.backend.events)
        self.assertIsNone(self.record())

    def test_same_slug_is_not_the_same_instance(self):
        first = self.ensure(branch="feature/first")
        second = self.ensure("second", "feature-first")
        self.assertNotEqual(first["name"], second["name"])
        self.assertNotEqual(first["data_id"], second["data_id"])
        self.assertEqual(sum(event[0] == "build" for event in self.backend.events), 1)

    def test_failed_assignment_is_not_reported_ready(self):
        self.backend.fail_assign = True
        with self.assertRaisesRegex(RuntimeError, "assignment failed"):
            self.ensure()
        self.assertNotEqual(self.record()["state"], "ready")
        self.backend.fail_assign = False
        record = self.ensure()
        self.assertEqual(record["state"], "ready")
        self.assertEqual(sum(event[0] == "run" for event in self.backend.events), 1)

    def test_manual_reassignment_is_corrected_before_ready(self):
        record = self.ensure()
        self.backend.items[record["name"]]["worktree"] = "another/branch"
        self.backend.events.clear()
        self.ensure()
        self.assertIn(("assign", record["name"], "--worktree", "feature/first"), self.backend.events)

    def test_manual_coast_removal_requires_data_cleanup(self):
        record = self.ensure()
        self.backend.command("rm", record["name"])
        with self.assertRaisesRegex(RuntimeError, "removed outside"):
            self.ensure()
        self.lifecycle.remove("first")
        self.assertFalse(self.backend.databases)
        self.assertFalse(self.backend.blobs)

    def test_invalid_data_identity_never_reaches_docker(self):
        backend = coast.Coast(self.root, "virtool")
        with patch.object(coast, "run") as command:
            with self.assertRaisesRegex(RuntimeError, "Invalid data identity"):
                backend.delete_data({"data_id": "postgres"})
        command.assert_not_called()

    def test_concurrent_ensure_requests_create_one_instance(self):
        def ensure_locked():
            with coast.lock(self.root / "registry/locks/first.lock"):
                return self.ensure()

        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(ensure_locked)
            second = pool.submit(ensure_locked)
            self.assertEqual(first.result()["name"], second.result()["name"])
        self.assertEqual(sum(event[0] == "run" for event in self.backend.events), 1)

    def test_recreated_git_directory_gets_a_new_generation(self):
        git_dir = self.root / "git-dir"
        git_dir.mkdir()
        registry = self.root / "registry"
        with patch.object(coast, "git", return_value=str(git_dir)):
            first = coast.worktree_key(self.root, registry, create=True)
            self.assertEqual(coast.worktree_key(self.root, registry, create=True), first)
            shutil.rmtree(git_dir)
            git_dir.mkdir()
            self.assertNotEqual(coast.worktree_key(self.root, registry, create=True), first)


class FingerprintTests(unittest.TestCase):
    def test_mounted_source_edits_do_not_rebuild_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = ["apps/internal/src/index.ts", "packages/data/src/db/pg.ts", "apps/web/src/main.tsx"]
            with patch.object(coast, "git", return_value="\0".join(files)):
                before = coast.fingerprint(root)
                for name in files:
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text("changed source")
                self.assertEqual(coast.fingerprint(root), before)

    def test_dependencies_migrations_and_watcher_changes_rebuild_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = ["pnpm-lock.yaml", "apps/internal/package.json", "apps/internal/dev/main.ts",
                     "packages/data/drizzle/0001.sql", "packages/data/package.json", "dev/scripts/coast.py"]
            with patch.object(coast, "git", return_value="\0".join(files)):
                for name in files:
                    before = coast.fingerprint(root)
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text("changed build input")
                    self.assertNotEqual(coast.fingerprint(root), before, name)


class DevelopmentDockerfileTests(unittest.TestCase):
    def test_includes_parent_and_copy_dependencies_but_excludes_workflow_stages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Dockerfile").write_text(
                "# syntax=docker/dockerfile:1-labs\n"
                "FROM node:24 AS base\nRUN corepack enable\n"
                "FROM rust:1 AS workflow\nRUN cargo build\n"
                "FROM debian:12 AS helper\nRUN touch /helper\n"
                "FROM base AS dev\nCOPY apps/web /repo/apps/web\n"
                "FROM dev AS dev-coast\nCOPY --from=helper /helper /helper\n")
            result = coast.development_dockerfile(root)
            self.assertTrue(result.startswith("# syntax=docker/dockerfile:1-labs\n"))
            self.assertIn("FROM node:24 AS base", result)
            self.assertIn("FROM debian:12 AS helper", result)
            self.assertIn("FROM base AS dev", result)
            self.assertNotIn("rust", result)
            self.assertNotIn("cargo", result)

    def test_unsupported_stage_dependencies_fail_before_building(self):
        for source in ("FROM node:24\n", "FROM node:24 AS dev-coast\nCOPY --from=0 /a /a\n",
                       "FROM node:24 AS dev-coast\nRUN --mount=from=builder echo test\n"):
            with self.subTest(source=source), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "Dockerfile").write_text(source)
                with self.assertRaises(RuntimeError):
                    coast.development_dockerfile(root)

    def test_workflow_changes_invalidate_fingerprint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "Dockerfile"
            path.write_text("FROM node:24 AS dev-coast\nFROM rust:1 AS workflow\n")
            files = ["Dockerfile", "packages/quality-core/src/lib.rs", "apps/nuvs/src/index.ts"]
            with patch.object(coast, "git", return_value="\0".join(files)):
                before = coast.fingerprint(root)
                crate = root / "packages/quality-core/src/lib.rs"
                crate.parent.mkdir(parents=True)
                crate.write_text("pub fn changed() {}")
                after_crate = coast.fingerprint(root)
                self.assertNotEqual(after_crate, before)
                app = root / "apps/nuvs/src/index.ts"
                app.parent.mkdir(parents=True)
                app.write_text("export const changed = true")
                after_app = coast.fingerprint(root)
                self.assertNotEqual(after_app, after_crate)
                path.write_text(path.read_text().replace("rust:1", "rust:2"))
                after_workflow_stage = coast.fingerprint(root)
                self.assertNotEqual(after_workflow_stage, after_app)
                path.write_text(path.read_text().replace("node:24", "node:26"))
                self.assertNotEqual(coast.fingerprint(root), after_workflow_stage)


class ImageTransferTests(unittest.TestCase):
    def rebuild(self, present_id, present_status=0, load_status=0):
        backend = coast.Coast(Path.cwd(), "virtool")
        configuration = {"services": {name: {"image": f"image/{name}"}
                                      for name in ("web", "migration", "jobs-api", "tasks")}}
        with patch.object(coast, "run", side_effect=[json.dumps(configuration), "sha256:expected"]), \
                patch.object(coast.subprocess, "run", side_effect=[
                    subprocess.CompletedProcess([], 0),
                    subprocess.CompletedProcess([], present_status, present_id),
                    subprocess.CompletedProcess([], load_status),
                ]), \
                patch.object(coast.subprocess, "Popen") as save, \
                patch.object(backend, "command"), patch.object(backend, "compose") as compose:
            save.return_value.__enter__.return_value.wait.return_value = 0
            backend.rebuild({"name": "test", "worktree": str(Path.cwd())}, "hash")
            return save.call_count, compose.call_args_list

    def test_identical_image_skips_transfer_but_restarts_services(self):
        transfers, calls = self.rebuild("sha256:expected\n")
        self.assertEqual(transfers, 0)
        self.assertEqual(len(calls), 2)
        self.assertIn("--force-recreate", calls[1].args)

    def test_missing_or_different_image_is_loaded(self):
        for image_id, status in (("", 1), ("sha256:other", 0)):
            with self.subTest(image_id=image_id):
                transfers, _ = self.rebuild(image_id, status)
                self.assertEqual(transfers, 1)

    def test_failed_load_does_not_report_success(self):
        with self.assertRaisesRegex(RuntimeError, "Failed to load"):
            self.rebuild("", 1, 1)


class ReadinessTests(unittest.TestCase):
    def test_running_watchers_do_not_hide_failed_services(self):
        backend = coast.Coast(Path.cwd(), "virtool")
        services = {"services": [{"name": name, "status": "running"}
                                  for name in ("web", "jobs-api", "tasks", "proxy")]}
        with patch.object(backend, "is_running", return_value=True), \
                patch.object(backend, "api", return_value=services), \
                patch.object(coast, "run", side_effect=RuntimeError("probe failed")):
            self.assertFalse(backend.ready({"name": "watcher"}))


if __name__ == "__main__":
    unittest.main()
