import pytest
import virtool.config


@pytest.fixture
def legacy_settings():
    return {
        "build_index_inst": 1,
        "build_index_mem": 4,
        "build_index_proc": 2,
        "create_sample_inst": 5,
        "create_sample_mem": 4,
        "create_sample_proc": 5,
        "create_subtraction_inst": 2,
        "create_subtraction_mem": 4,
        "create_subtraction_proc": 4,
        "data_path": "/virtool/data",
        "db_host": "localhost",
        "db_name": "virtool",
        "db_password": "",
        "db_port": 27017,
        "db_use_auth": False,
        "db_use_ssl": False,
        "db_username": "",
        "default_source_types": [
            "isolate",
            "strain"
        ],
        "dummy_inst": 5,
        "dummy_mem": 1,
        "dummy_proc": 1,
        "enable_api": True,
        "enable_sentry": False,
        "hmm_slug": "virtool/virtool-hmm",
        "mem": 120,
        "minimum_password_length": 8,
        "nuvs_inst": 6,
        "nuvs_mem": 50,
        "nuvs_proc": 15,
        "pathoscope_bowtie_inst": 3,
        "pathoscope_bowtie_mem": 50,
        "pathoscope_bowtie_proc": 15,
        "proc": 30,
        "proxy_address": "",
        "proxy_enable": False,
        "proxy_password": "",
        "proxy_trust": False,
        "proxy_username": "",
        "sample_all_read": True,
        "sample_all_write": True,
        "sample_group": "none",
        "sample_group_read": True,
        "sample_group_write": True,
        "sample_unique_names": True,
        "server_host": "localhost",
        "server_port": 9950,
        "software_channel": "stable",
        "watch_path": "/virtool/watch"
    }


def test_schema():
    """
    Check that schema has not changed.

    """
    assert virtool.config.SCHEMA == {
        # HTTP Server
        "host": {
            "type": "string",
            "default": "localhost"
        },
        "port": {
            "type": "integer",
            "default": 9950
        },

        # File paths
        "data_path": {
            "type": "string",
            "default": "data"
        },
        "watch_path": {
            "type": "string",
            "default": "watch"
        },

        # Host resource limits
        "proc": {
            "type": "integer",
            "default": 8
        },
        "mem": {
            "type": "integer",
            "default": 16
        },

        # MongoDB
        "db": {
            "type": "string",
            "default": ""
        },

        # Proxy
        "proxy": {
            "type": "string",
            "default": ""
        }
    }


def test_check_limits(mocker):
    m_get_resources = mocker.patch("virtool.resources.get", return_value={"proc": 24, "mem": 48})


def test_get_defaults(mocker):
    mocker.patch("virtool.config.SCHEMA", {
        "foo": {
            "type": "integer",
            "default": 2
        },
        "bar": {
            "type": "string",
            "default": "hello"
        }
    })

    assert virtool.config.get_defaults() == {
        "foo": 2,
        "bar": "hello"
    }


@pytest.mark.parametrize("username", ["foo",""])
@pytest.mark.parametrize("password", ["bar", ""])
@pytest.mark.parametrize("auth", [True, False])
@pytest.mark.parametrize("ssl", [True, False])
def test_convert_db(username, password, auth, ssl):
    legacy_settings = {
        "db_host": "localhost",
        "db_name": "virtool",
        "db_password": password,
        "db_port": 27017,
        "db_use_auth": auth,
        "db_use_ssl": ssl,
        "db_username": username,
        "enable_api": True
    }

    virtool.config.convert_db(legacy_settings)

    db = "mongodb://localhost:27017/virtool"

    if username and password and auth:
        db = "mongodb://foo:bar@localhost:27017/virtool"

        if ssl:
            db += "?ssl=true"

    assert legacy_settings == {
        "db": db,
        "enable_api": True
    }


def test_convert_job_limits():
    legacy_settings = {
        "build_index_inst": 1,
        "build_index_mem": 4,
        "build_index_proc": 2,
        "create_sample_inst": 5,
        "create_sample_mem": 4,
        "create_sample_proc": 5,
        "create_subtraction_inst": 2,
        "create_subtraction_mem": 4,
        "create_subtraction_proc": 4,
        "dummy_inst": 5,
        "dummy_mem": 1,
        "dummy_proc": 1,
        "enable_api": True,
        "nuvs_inst": 6,
        "nuvs_mem": 50,
        "nuvs_proc": 15,
        "pathoscope_bowtie_inst": 3,
        "pathoscope_bowtie_mem": 50,
        "pathoscope_bowtie_proc": 15
    }

    virtool.config.convert_job_limits(legacy_settings)

    assert legacy_settings == {
        "sm_mem": 4,
        "sm_proc": 5,
        "lg_mem": 50,
        "lg_proc": 15,
        "enable_api": True
    }


@pytest.mark.parametrize("address", ["http://localhost:9081", ""])
@pytest.mark.parametrize("enable", [True, False])
@pytest.mark.parametrize("trust", [True, False])
@pytest.mark.parametrize("password", ["foobar", ""])
def test_convert_proxy(address, enable, trust, password):
    legacy_settings = {
        "proxy_address": address,
        "proxy_enable": enable,
        "proxy_password": password,
        "proxy_trust": trust,
        "proxy_username": "baz",
        "software_channel": "stable"
    }

    virtool.config.convert_proxy(legacy_settings)

    proxy = ""

    if enable and address and not trust:
        proxy = "http://localhost:9081"

        if password:
            proxy = "http://baz:foobar@localhost:9081"

    assert legacy_settings == {
        "proxy": proxy,
        "software_channel": "stable"
    }


def test_remove_defaults(mocker):
    defaults = {
        "proc": 24,
        "mem": 48
    }

    m_get_defaults = mocker.patch("virtool.config.get_defaults", return_value=defaults)

    config = {
        "proc": 24,
        "mem": 24
    }

    virtool.config.remove_defaults(config)

    assert config == {
        "mem": 24
    }
