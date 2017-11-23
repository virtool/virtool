import argparse
import base64
import json
import requests

import virtool.updates


def get_release_data(username, token):
    release_data = dict()

    for repo, key in [("virtool", "software"), ("virtool-database", "database"), ("virtool-hmm", "hmm")]:
        release_data[key] = list()

        releases = list()

        for i in range(1, 5):
            url = "https://api.github.com/repos/virtool/{}/releases?per_page=100&page={}".format(repo, i)
            body = requests.get(url, auth=(username, token)).json()

            if not body:
                break

            releases += body

        release_data[key] = [virtool.updates.format_software_release(r) for r in releases if r["assets"]]

    return release_data


def update_website_json(data, username, token):
    url = "https://api.github.com/repos/virtool/virtool-website/contents/_data/releases.json"

    body = requests.get(url, auth=(username, token)).json()

    import pprint
    pprint.pprint(body)

    sha = body["sha"]

    encoded = base64.standard_b64encode(json.dumps(data).encode()).decode("ascii")

    requests.put(url, auth=(username, token), json={
        "message": "Update releases.json",
        "committer": {
            "name": "Travis Build",
            "email": "dev@virtool.ca"
        },
        "content": encoded,
        "sha": sha
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        dest="github_username",
        help="username for accessing github API"
    )

    parser.add_argument(
        dest="github_token",
        help="perosnal auth token for querying API"
    )

    args = parser.parse_args()

    data = get_release_data(args.github_username, args.github_token)

    update_website_json(data, args.github_username, args.github_token)


