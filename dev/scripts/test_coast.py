import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import shutil
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


if __name__ == "__main__":
    unittest.main()
