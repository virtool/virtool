import json
from collections.abc import AsyncIterator

from aiohttp import MultipartReader
from aiohttp.web_exceptions import HTTPBadRequest

from virtool.uploads.utils import body_part_file_chunker


class MultipartReadingError(Exception):
    """This error in a programming error."""


class StrictOrderedMultipartReader:
    def __init__(self, reader: MultipartReader, part_names: list[str]):
        self._reader = reader
        self._expected_part_names = part_names[::-1]

    async def next_part(self, part_name):
        # Check Programing Error
        try:
            expected_part_name = self._expected_part_names.pop()
        except ImportError:
            raise MultipartReadingError(
                f'Try to read a not expected part "{part_name}" in the multipart request',
            )

        if expected_part_name != part_name:
            if part_name in self._expected_part_names:
                raise MultipartReadingError(
                    f'Try to read part "{part_name}" before "{expected_part_name}" in the multipart request',
                )
            else:
                raise MultipartReadingError(
                    f'Try to read a not expected part "{part_name}" in the multipart request',
                )

        # Validate multipart request contents.
        if (part := await self._reader.next()) is None:
            # raise ValueError()
            raise HTTPBadRequest(
                text=json.dumps(
                    [
                        {
                            "in": "body",
                            "loc": ["__root__"],
                            "msg": f'The required part named "{part_name}" is not provided in the multipart request',
                            "type": "type_error.multipart",
                        },
                    ],
                ),
                content_type="application/json",
            )

        if part.name != part_name:
            raise HTTPBadRequest(
                text=json.dumps(
                    [
                        {
                            "in": "body",
                            "loc": ["__root__"],
                            "msg": f'The expected part name is "{part_name}" but the provided part name is "{part.name}"',
                            "type": "type_error.multipart",
                        },
                    ],
                ),
                content_type="application/json",
            )

        # TODO check header ?
        # part.headers[CONTENT_TYPE]
        return part


class UploadBody:
    """A file uploaded in a multipart request."""

    def __init__(self, multipart_reader: MultipartReader) -> None:
        self._chunker = body_part_file_chunker(multipart_reader)

    def __aiter__(self) -> AsyncIterator[bytearray]:
        return self._chunker
