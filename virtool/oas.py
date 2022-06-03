"""
Generate api-doc using: python3 -m aiohttp_pydantic.oas virtool.oas:app
"""

from virtool.app import create_app_without_startup

app = create_app_without_startup()
