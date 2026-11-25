from __future__ import annotations

import argparse

from pipelines.ilostat.refresh import refresh
from .server import serve


def main():
    parser = argparse.ArgumentParser(prog="iwa", description="Informal Work Atlas tools")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("serve", help="Run the local web application and API")
    commands.add_parser("refresh", help="Discover, download and validate selected ILOSTAT data")
    args = parser.parse_args()
    if args.command == "serve":
        serve()
    elif args.command == "refresh":
        refresh()


if __name__ == "__main__":
    main()

