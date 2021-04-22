from virtool.hmm.fake import create_fake_hmms


async def test_fake_hmms(app, snapshot, tmp_path, dbi, example_path, pg):
    hmm_dir = tmp_path / "hmm"
    hmm_dir.mkdir()

    await create_fake_hmms(app)

    snapshot.assert_match(await dbi.hmm.find().to_list(None))

    with open(hmm_dir / "profiles.hmm", "r") as f_result:
        with open(example_path / "hmms/profiles.hmm") as f_expected:
            assert f_result.read() == f_expected.read()
