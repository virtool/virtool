from argparse import ArgumentParser


def get_args():

    parser = ArgumentParser()

    parser.add_argument(
        "-H", "--host",
        dest="host",
        default="localhost",
        help="hostname to listen on"
    )

    parser.add_argument(
        "-p", "--port",
        dest="port",
        default=9550,
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
        "-P", "--write-pid",
        dest="write_pid",
        action="store_true",
        default=False,
        help="write a pidfile on start"
    )

    return parser.parse_args()