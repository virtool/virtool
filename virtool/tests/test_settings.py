import os
import json
import motor
import pymongo
import pytest

import virtool.settings


class Harness:

    def __init__(self, dispatch_func, settings_json, settings_class):
        self.dispatch_func = dispatch_func
        self.settings_json = settings_json
        self.settings_class = settings_class

    def create(self, version="1.0.12"):
        if self.dispatch_func is None:
            return self.settings_class(version, self.settings_json)
        else:
            return self.settings_class(self.dispatch_func, version, self.settings_json)

    def json_has(self, match_dict):
        with open(self.settings_json, "r") as handle:
            data = json.load(handle)
            return all(data[key] == value for key, value in match_dict.items())

    def dump_json(self, settings_dict):
        with open(self.settings_json, "w") as handle:
            json.dump(settings_dict, handle)


@pytest.fixture(scope="function", params=["simple", "collection"])
def settings_harness(request, tmpdir, called_tester):

    settings_json = os.path.join(str(tmpdir), "settings.json")

    if request.param == "collection":
        yield Harness(called_tester(), settings_json, virtool.settings.Collection)
    else:
        yield Harness(None, settings_json, virtool.settings.Simple)

    os.remove(settings_json)


@pytest.fixture(scope="function")
def simple_fixture():
    test = "thingy"

    yield test

    test = "other"

    print(test)


@pytest.fixture(scope="function")
def collection_harness(tmpdir, called_tester):
    settings_json = os.path.join(str(tmpdir), "settings.json")

    yield Harness(called_tester(), settings_json, virtool.settings.Collection)

    os.remove(settings_json)


class TestShared:

    def test_init(self, settings_harness):
        settings = settings_harness.create()

        assert os.path.isfile(settings_harness.settings_json)
        assert len(settings.data) == len(virtool.settings.DEFAULTS)

    def test_version(self, settings_harness):
        """
        Test the ``version`` number passed to the settings constructor is set as the value for the ``server_version``
        setting.

        """
        settings = settings_harness.create(version="1.0.12")

        # Verify that the version is set in the settings.data dict.
        assert settings.data["server_version"] == "1.0.12"

        # Verify that the version was written to the settings.json file.
        assert settings_harness.json_has({"server_version": "1.0.12"})

    def test_load_precedence(self, settings_harness):
        """
        Test that setting values from settings.json take precedence over those in the DEFAULTS dict.

        """
        # Make a dict with the default settings values in it, then set "server_port" to non-default 23217.
        test_dict = dict(virtool.settings.DEFAULTS)
        test_dict["server_port"] = 23217

        # Write the test dict to settings.json.
        settings_harness.dump_json(test_dict)

        # Verify that server port is 23217 in settings.json.
        assert settings_harness.json_has({"server_port": 23217})

        # Create a settings object using the test settings.json file.
        settings = settings_harness.create()

        # Make sure the 23217 port number was loaded from the JSON file instead of assigning the default 9650.
        assert settings.data["server_port"] == 23217

    def test_restore_file(self, settings_harness):
        """
        Test that a complete settings object and settings.json file can be built from an incomplete settings.json file.

        """
        # Build a test settings dict with some keys missing.
        test_dict = dict(virtool.settings.DEFAULTS)

        removed_keys = ["db_host", "db_port", "allowed_source_types"]

        for key in removed_keys:
            del test_dict[key]

        # Dump the test_dict to a settings.json file.
        settings_harness.dump_json(test_dict)

        # Make sure the deleted keys are missing from the settings.json file.
        with open(settings_harness.settings_json, "r") as handle:
            content = json.load(handle)
            assert all(key not in content for key in removed_keys)

        # Initialize a settings object.
        settings = settings_harness.create()

        # Verify that a complete settings dict was created in the settings object.
        assert settings.get("db_host") == "localhost"
        assert settings.get("db_port") == 27017
        assert settings.get("allowed_source_types") == ["isolate", "genotype"]

        # Verify that the settings.json file was repaired to include all settings keys.
        with open(settings_harness.settings_json, "r") as handle:
            content = json.load(handle)
            assert content["db_host"] == "localhost"
            assert content["db_port"] == 27017
            assert content["allowed_source_types"] == ["isolate", "genotype"]

    def test_restore_types(self, settings_harness):
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

        settings_harness.dump_json(test_dict)

        # Make sure the incorrect types are in the settings.json file.
        settings_harness.json_has({
            "db_port": "23791",
            "db_name": 801
        })

        # Make a settings object from the previously written settings.json file.
        settings = settings_harness.create()

        # Verify that the setting types were corrected in the settings.data dict.
        assert settings.get("db_port") == 23791
        assert settings.get("db_name") == "801"

        # Verify that a corrected settings.json file was written.
        settings_harness.json_has({
            "db_port": 23791,
            "db_name": "801"
        })

    def test_easy_update(self, settings_harness):
        """
        Test the settings.update method with passed data where no type corrections are required.

        """
        # Make a new settings object with no pre-existing settings.json file.
        settings = settings_harness.create()

        # Verify that the ``server_port`` is set to the default, 9650.
        assert settings.get("server_port") == 9650

        # Verify the the ``server_port`` value written to settings.json is the default value.
        assert settings_harness.json_has({
            "server_port": 9650
        })

        # Call the settings update method to update the ``server_port`` value to 8888 with the correct ``int`` typing.
        settings.update({
            "server_port": 8888
        })

        # Verify that ``server_port`` was changed in the settings.data dict and in the settings.json file.
        assert settings.get("server_port") == 8888

        assert settings_harness.json_has({
            "server_port": 8888
        })

    def test_difficult_update(self, settings_harness):
        """
        Test the settings.update method with passed data where type corrections are required.

        """
        # Initialize a settings object and verify that ``server_port`` is set to the default 9650.
        settings = settings_harness.create()

        assert settings.get("server_port") == 9650

        # Verify that settings.json contains the correctly typed default value.
        assert settings_harness.json_has({
            "server_port": 9650
        })

        # Call settings.update with an incorrectly typed (``str``) value.
        settings.update({
            "server_port": "8888"
        })

        # Verify that the value was changed and corrected in the settings.data dict.
        assert settings.get("server_port") == 8888

        # Verify that the value was changed and corrected in settings.json.
        assert settings_harness.json_has({
            "server_port": 8888
        })

    def test_db_client_sync(self, settings_harness):
        """
        Test that the method returns a valid :class:`pymongo.database.Database` object when called with ``sync`` set to
        ``True``.

        """
        settings = settings_harness.create()

        settings.update({
            "db_name": "settings-test-sync"
        })

        db = settings.get_db_client(sync=True)

        assert db.name == "settings-test-sync"
        assert isinstance(db, pymongo.database.Database)

        assert db.client.address == ("localhost", 27017)

    def test_db_client_async(self, settings_harness):
        """
        Test that the method returns a valid :class:`motor.motor_tornado.MotorDatabase` object when called with ``sync``
        set to ``False``.

        """
        settings = settings_harness.create()

        settings.update({
            "db_name": "settings-test-async"
        })

        db = settings.get_db_client(sync=False)

        assert db.name == "settings-test-async"
        assert isinstance(db, motor.motor_tornado.MotorDatabase)

        assert db.client.HOST == "localhost"
        assert db.client.PORT == 27017

    def test_as_dict(self, settings_harness):
        """
        Test the the method returns a dict that is identical to the object's internal settings dict, but is not the same
        object.

        """
        settings = settings_harness.create()

        test_dict = dict(virtool.settings.DEFAULTS)
        test_dict["db_port"] = 28902

        settings.update({"db_port": 28902})

        generated_dict = settings.as_dict()

        assert id(generated_dict) != id(settings.data)

        assert generated_dict == settings.data


class TestCollection:

    def test_init(self, collection_harness):
        collection = collection_harness.create()

        assert collection.dispatch == collection_harness.dispatch_func

    @pytest.mark.gen_test
    def test_set(self, mock_transaction, collection_harness):
        collection = collection_harness.create()

        message = {
            "collection_name": "settings",
            "method_name": "set",
            "data": {
                "server_port": 8801
            }
        }

        transaction = mock_transaction(message, permissions="all", administrator=True)

        yield collection.set(transaction)

        assert collection.get("server_port") == 8801

        assert collection_harness.json_has({"server_port": 8801})

        assert collection_harness.dispatch_func.was_called

        assert collection_harness.dispatch_func.with_args[0]["collection_name"] == "settings"

        assert collection_harness.dispatch_func.with_args[0]["operation"] == "set"

        assert collection_harness.dispatch_func.with_args[0]["data"]["server_port"] == 8801

        assert len(collection_harness.dispatch_func.with_args[0]["data"]) == len(collection.data)

        assert transaction.fulfill_called == (True, collection.data)

    @pytest.mark.gen_test
    def test_bad_set(self, mock_transaction, collection_harness):
        """
        Make sure that calls to collection.set with unknown settings keys do not result in changes to settings, writes
        to the settings.json file, dispatches to clients, or successfully fulfill the transaction.

        """
        collection = collection_harness.create()

        message = {
            "collection_name": "settings",
            "method_name": "set",
            "data": {
                "fake_setting": "this_should_not_work"
            }
        }

        transaction = mock_transaction(message, permissions="all", administrator=True)

        # Copy the current settings so we can make sure they are unchanged later.
        old_settings = dict(collection.data)

        # Call the set coroutine.
        yield collection.set(transaction)

        # Make sure the collection dispatch method was not called.
        assert not collection_harness.dispatch_func.was_called

        # Make sure no changes were made to the settings data dict.
        assert old_settings == collection.data

        # Make sure the transaction was fulfilled with success set to False.
        assert transaction.fulfill_called[0] is False

    @pytest.mark.gen_test
    def test_download(self, mock_transaction, collection_harness):
        collection = collection_harness.create()

        message = {
            "collection_name": "settings",
            "method_name": "download",
            "data": None
        }

        # Make sure the settings data (from DEFAULTS), is sent in the fulfilled transaction.
        transaction = mock_transaction(message, permissions="all", administrator=True)
        print(transaction)
        yield collection.download(transaction)
        success, data = transaction.fulfill_called

        assert success is True
        assert data == collection.data

        # Make a change to a single settings value.
        collection.update({"server_port": 8801})

        # Make sure the changed data is sent in the fulfilled transaction.
        transaction = mock_transaction(message, permissions="all", administrator=True)
        yield collection.download(transaction)
        success, data = transaction.fulfill_called

        assert success
        assert data["server_port"] == 8801

    @pytest.mark.gen_test
    def test_load_with_data_and_file(self, collection_harness):
        collection = collection_harness.create()

        test_dict = dict(virtool.settings.DEFAULTS)
        test_dict["server_port"] = 23217

        collection_harness.dump_json(test_dict)

        # There should be a mismatch between the settings object and the settings.json file.
        assert collection.get("server_port") == 9650
        assert collection_harness.json_has({"server_port": 23217})

        yield collection.load()

        # Object and file should now match.
        assert collection.get("server_port") == 23217
        assert collection_harness.json_has({"server_port": 23217})

    @pytest.mark.gen_test
    def test_load_with_data_no_file(self, collection_harness):
        """

        """
        collection = collection_harness.create()

        collection.update({"server_port": 38921})

        assert collection_harness.json_has({"server_port": 38921})

        os.remove(collection_harness.settings_json)

        yield collection.load()

        assert os.path.isfile(collection_harness.settings_json)

        assert collection_harness.json_has({"server_port": 38921})

    @pytest.mark.gen_test
    def test_load_no_data_no_file(self, collection_harness):

        collection = collection_harness.create()

        with open(collection_harness.settings_json, "r") as handle:
            assert collection.data == json.load(handle)
