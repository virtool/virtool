import filecmp
from pathlib import Path

from pyfixtures import FixtureScope
from syrupy import SnapshotAssertion

from virtool.workflow.data.hmms import WFHMMs


async def test_ok(
    example_path: Path,
    scope: FixtureScope,
    snapshot: SnapshotAssertion,
    work_path: Path,
):
    """Test that the hmms fixture instantiates and contains the expected data."""
    hmms: WFHMMs = await scope.instantiate_by_key("hmms")

    assert hmms.path == work_path / "hmms"
    assert hmms.profiles_path == hmms.path / "profiles.hmm"

    assert hmms.annotations == snapshot(name="annotations")
    assert hmms.cluster_annotation_map == snapshot(name="cluster_annotation_map")
    assert hmms.get_id_by_cluster(10) == "8s1nqs1w"

    assert filecmp.cmp(
        hmms.profiles_path, example_path / "hmms" / "profiles.hmm", shallow=False
    )
