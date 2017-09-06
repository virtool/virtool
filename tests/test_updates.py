import pytest

import virtool.updates


@pytest.fixture
def mock_release():
    return {
        "url": "https://api.github.com/repos/virtool/virtool/releases/5864133",
        "assets_url": "https://api.github.com/repos/virtool/virtool/releases/5864133/assets",
        "upload_url": "https://uploads.github.com/repos/virtool/virtool/releases/5864133/assets{?name,label}",
        "html_url": "https://github.com/virtool/virtool/releases/tag/v1.8.5",
        "id": 5864133,
        "tag_name": "v1.8.5",
        "target_commitish": "master",
        "name": "v1.8.5",
        "draft": False,
        "author": {
            "login": "igboyes",
            "id": 5943558,
            "avatar_url": "https://avatars1.githubusercontent.com/u/5943558?v=4",
            "gravatar_id": "",
            "url": "https://api.github.com/users/igboyes",
            "html_url": "https://github.com/igboyes",
            "followers_url": "https://api.github.com/users/igboyes/followers",
            "following_url": "https://api.github.com/users/igboyes/following{/other_user}",
            "gists_url": "https://api.github.com/users/igboyes/gists{/gist_id}",
            "starred_url": "https://api.github.com/users/igboyes/starred{/owner}{/repo}",
            "subscriptions_url": "https://api.github.com/users/igboyes/subscriptions",
            "organizations_url": "https://api.github.com/users/igboyes/orgs",
            "repos_url": "https://api.github.com/users/igboyes/repos",
            "events_url": "https://api.github.com/users/igboyes/events{/privacy}",
            "received_events_url": "https://api.github.com/users/igboyes/received_events",
            "type": "User",
            "site_admin": False
        },
        "prerelease": False,
        "created_at": "2017-03-24T20:52:23Z",
        "published_at": "2017-03-24T21:03:18Z",
        "assets": [
            {
                "url": "https://api.github.com/repos/virtool/virtool/releases/assets/3483395",
                "id": 3483395,
                "name": "virtool.tar.gz",
                "label": "",
                "uploader": {
                "login": "igboyes",
                "id": 5943558,
                "avatar_url": "https://avatars1.githubusercontent.com/u/5943558?v=4",
                "gravatar_id": "",
                "url": "https://api.github.com/users/igboyes",
                "html_url": "https://github.com/igboyes",
                "followers_url": "https://api.github.com/users/igboyes/followers",
                "following_url": "https://api.github.com/users/igboyes/following{/other_user}",
                "gists_url": "https://api.github.com/users/igboyes/gists{/gist_id}",
                "starred_url": "https://api.github.com/users/igboyes/starred{/owner}{/repo}",
                "subscriptions_url": "https://api.github.com/users/igboyes/subscriptions",
                "organizations_url": "https://api.github.com/users/igboyes/orgs",
                "repos_url": "https://api.github.com/users/igboyes/repos",
                "events_url": "https://api.github.com/users/igboyes/events{/privacy}",
                "received_events_url": "https://api.github.com/users/igboyes/received_events",
                "type": "User",
                "site_admin": False
            },
                "content_type": "application/gzip",
                "state": "uploaded",
                "size": 49963781,
                "download_count": 41,
                "created_at": "2017-03-24T21:08:33Z",
                "updated_at": "2017-03-24T21:08:35Z",
                "browser_download_url": "https://github.com/virtool/virtool/releases/download/v1.8.5/virtool.tar.gz"
            }
        ],
        "tarball_url": "https://api.github.com/repos/virtool/virtool/tarball/v1.8.5",
        "zipball_url": "https://api.github.com/repos/virtool/virtool/zipball/v1.8.5",
        "body": "- add software tests for `hmm.py` module\r\n- allow upload and import of `*.hmm` profile files and "
                "annotations\r\n- remove dropdown menu for checking `*hmm` files\r\n- show _none found_ message when "
                "there are no annotations\r\n- fix #90"
    }


def test_format_software_release(mock_release):
    assert virtool.updates.format_software_release(mock_release) == {
        "name": "v1.8.5",
        "body": "- add software tests for `hmm.py` module\r\n- allow upload and import of `*.hmm` profile files "
                "and annotations\r\n- remove dropdown menu for checking `*hmm` files\r\n- show _none found_ message "
                "when there are no annotations\r\n- fix #90",
        "prerelease": False,
        "published_at": "2017-03-24T21:03:18Z",
        "html_url": "https://github.com/virtool/virtool/releases/tag/v1.8.5",
        "filename": "virtool.tar.gz",
        "content_type": "application/gzip",
        "size": 49963781,
        "download_url": "https://github.com/virtool/virtool/releases/download/v1.8.5/virtool.tar.gz",
        "asset_error": False
    }
