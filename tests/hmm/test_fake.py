from virtool.fake.wrapper import FakerWrapper
from virtool.hmm.fake import create_fake_hmms


async def test_fake_hmms(snapshot, tmpdir, dbi, example_path, pg):
    data_path = str(tmpdir)
    hmm_dir = tmpdir.mkdir("hmm")

    app = {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "settings": {
            "data_path": data_path
        }
    }

    await create_fake_hmms(app)

    snapshot.assert_match(await dbi.hmm.find().to_list(None))

    with open(hmm_dir / "profiles.hmm", "r") as f_result:
        with open(example_path / "hmms/profiles.hmm") as f_expected:
            assert f_result.read() == f_expected.read()
