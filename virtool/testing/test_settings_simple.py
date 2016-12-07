import os
import json
import motor
import pymongo
import pytest

import virtool.settings


@pytest.fixture(scope="function")
def settings_json(tmpdir):
    settings_path = os.path.join(str(tmpdir), "settings.json")
    yield settings_path
    os.remove(settings_path)


def test_init(settings_json):

    settings = virtool.settings.Simple(settings_path=settings_json)

    assert os.path.isfile(settings_json)
    assert len(settings.data) == len(virtool.settings.DEFAULTS)


def test_version(settings_json):
    """
    Test the ``version`` number passed to the settings constructor is set as the value for the ``server_version``
    setting.

    """
    settings = virtool.settings.Simple(version="1.0.12", settings_path=settings_json)

    # Verify that the version is set in the settings.data dict.
    assert settings.data["server_version"] == "1.0.12"

    # Verify that the version was written to the settings.json file.
    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_version"] == "1.0.12"


def test_load_precedence(settings_json):
    """
    Test that setting values from settings.json take precedence over those in the DEFAULTS dict.

    """
    # Make a dict with the default settings values in it, then set "server_port" to non-default 23217.
    test_dict = dict(virtool.settings.DEFAULTS)
    test_dict["server_port"] = 23217

    # Write the test dict to settings.json.
    with open(settings_json, "w") as handle:
        json.dump(test_dict, handle)

    # Verify that server port is 23217 in settings.json.
    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_port"] == 23217

    # Create a settings object using the test settings.json file.
    settings = virtool.settings.Simple(settings_path=settings_json)

    # Make sure the 23217 port number was loaded from the JSON file instead of assigning the default 9650.
    assert settings.data["server_port"] == 23217


def test_restore_file(settings_json):
    """
    Test that a complete settings object and settings.json file can be built from an incomplete settings.json file.

    """
    # Build a test settings dict with some keys missing.
    test_dict = dict(virtool.settings.DEFAULTS)

    del test_dict["db_host"]
    del test_dict["db_port"]
    del test_dict["allowed_source_types"]

    # Dump the test_dict to a settings.json file.
    with open(settings_json, "w") as handle:
        json.dump(test_dict, handle)

    # Make sure the deleted keys are missing from the settings.json file.
    with open(settings_json, "r") as handle:
        content = json.load(handle)
        assert "db_host" not in content
        assert "db_port" not in content
        assert "allowed_source_types" not in content

    # Initialize a settings object.
    settings = virtool.settings.Simple(settings_path=settings_json)

    # Verify that a complete settings dict was created in the settings object.
    assert settings.get("db_host") == "localhost"
    assert settings.get("db_port") == 27017
    assert settings.get("allowed_source_types") == ["isolate", "genotype"]

    # Verify that the settings.json file was repaired to include all settings keys.
    with open(settings_json, "r") as handle:
        content = json.load(handle)
        assert content["db_host"] == "localhost"
        assert content["db_port"] == 27017
        assert content["allowed_source_types"] == ["isolate", "genotype"]


def test_restore_types(settings_json):
    """
    Test that incorrect types a settings.json file used to build a settings object are properly converted to the
    correct types. Test the the newly typed values are written correctly to a new settings.json file.

    """
    # Make a test settings dict with some incorrect types and write it to a settings.json file.
    test_dict = dict(virtool.settings.DEFAULTS)

    test_dict.update({
        "db_port": "23791",
        "db_name": 801
    })

    with open(settings_json, "w") as handle:
        json.dump(test_dict, handle)

    # Make sure the incorrect types are in the settings.json file.
    with open(settings_json, "r") as handle:
        content = json.load(handle)
        assert content["db_port"] == "23791"
        assert content["db_name"] == 801

    # Make a settings object from the previously written settings.json file.
    settings = virtool.settings.Simple(settings_path=settings_json)

    # Verify that the setting types were corrected in the settings.data dict.
    assert settings.get("db_port") == 23791
    assert settings.get("db_name") == "801"

    # Verify that a corrected settings.json file was written.
    with open(settings_json, "r") as handle:
        content = json.load(handle)
        assert content["db_port"] == 23791
        assert content["db_name"] == "801"


def test_easy_update(settings_json):
    """
    Test the settings.update method with passed data where no type corrections are required.

    """
    # Make a new settings object with no pre-existing settings.json file.
    settings = virtool.settings.Simple(settings_path=settings_json)

    # Verify that the ``server_port`` is set to the default, 9650.
    assert settings.get("server_port") == 9650

    # Verify the the ``server_port`` value written to settings.json is the default value.
    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_port"] == 9650

    # Call the settings update method to update the ``server_port`` value to 8888 with the correct ``int`` typing.
    settings.update({
        "server_port": 8888
    })

    # Verify that ``server_port`` was changed in the settings.data dict and in the settings.json file.
    assert settings.get("server_port") == 8888

    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_port"] == 8888


def test_hard_update(settings_json):
    """
    Test the settings.update method with passed data where type corrections are required.

    """
    # Initialize a settings object and verify that ``server_port`` is set to the default 9650.
    settings = virtool.settings.Simple(settings_path=settings_json)
    print(settings.get("server_port"))
    assert settings.get("server_port") == 9650

    # Verify that settings.json contains the correctly typed default value.
    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_port"] == 9650

    # Call settings.update with an incorrectly typed (``str``) value.
    settings.update({
        "server_port": "8888"
    })

    # Verify that the value was changed and corrected in the settings.data dict.
    assert settings.get("server_port") == 8888

    # Verify that the value was changed and corrected in settings.json.
    with open(settings_json, "r") as handle:
        assert json.load(handle)["server_port"] == 8888


def test_db_client_sync(settings_json):
    settings = virtool.settings.Simple(settings_path=settings_json)

    settings.update({
        "db_name": "settings-test-sync"
    })

    db = settings.get_db_client(sync=True)

    assert db.name == "settings-test-sync"
    assert isinstance(db, pymongo.database.Database)

    assert db.client.address == ("localhost", 27017)


def test_db_client_async(settings_json):
    settings = virtool.settings.Simple(settings_path=settings_json)

    settings.update({
        "db_name": "settings-test-async"
    })

    db = settings.get_db_client(sync=False)

    assert db.name == "settings-test-async"
    assert isinstance(db, motor.motor_tornado.MotorDatabase)

    assert db.client.HOST == "localhost"
    assert db.client.PORT == 27017


















