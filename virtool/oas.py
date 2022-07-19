"""
Generate api-doc using: python3 -m virtool.custom_oas.oas virtool.oas:app
"""

from virtool.app import create_app_without_startup

app = create_app_without_startup()
