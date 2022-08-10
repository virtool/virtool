import argparse

from virtool.custom_oas.oas.cmd import setup

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Open API Specification")
    setup(parser)
    args = parser.parse_args()
    args.func(args)
