from argparse import ArgumentParser


def get_args():
    parser = ArgumentParser()

    parser.add_argument(
        "-H", "--host",
        dest="host",
        help="hostname to listen on"
    )

    parser.add_argument(
        "-p", "--port",
        dest="port",
        help="port to listen on"
    )

    parser.add_argument(
        "-v", "--verbose",
        dest="verbose",
        action="store_true",
        default=False,
        help="log debug messages"
    )

    parser.add_argument(
        "--dev",
        dest="dev",
        action="store_true",
        default=False,
        help="run in dev mode"
    )

    parser.add_argument(
        "--force-version",
        dest="force_version",
        help="make the server think it is the passed FORCE_VERSION or v1.8.5 if none provided",
        nargs="?",
        const="v1.8.5"
    )

    parser.add_argument(
        "--no-sentry",
        dest="no_sentry",
        help="prevent initialization of Sentry error monitoring",
        action="store_true",
        default=False
    )

    return parser.parse_args()
