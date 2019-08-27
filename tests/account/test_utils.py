import virtool.account


def test_generate_api_key(mocker):
    """
    Test that API keys are generated using UUID4 and that :func:`generate_api_key()` returns the raw and hashed version
    of the key. Hashing is done through a call to :func:`hash_api_key`.

    """
    class MockUUID4:
        hex = "foo"

    m_uuid = mocker.patch("uuid.uuid4", return_value=MockUUID4())
    m_hash_api_key = mocker.patch("virtool.users.utils.hash_api_key", return_value="bar")

    assert virtool.account.utils.generate_api_key() == ("foo", "bar")

    assert m_uuid.called

    m_hash_api_key.assert_called_with("foo")
