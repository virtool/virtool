import pytest

from virtool.otus.oas import CreateOTURequest, UpdateOTURequest


@pytest.fixture
def test_otu_edit():
    """An :class:`tuple` containing old and new otu documents for testing history diffing."""
    return (
        {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                            "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None,
                        }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate",
                }
            ],
            "reference": {"id": "hxn167"},
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "name": "Prunus virus F",
            "schema": [],
            "version": 0,
        },
        {
            "_id": "6116cba1",
            "abbreviation": "",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                            "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None,
                        }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate",
                }
            ],
            "reference": {"id": "hxn167"},
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "name": "Prunus virus E",
            "schema": [],
            "version": 1,
        },
    )


@pytest.fixture
def build_otu_history(data_layer, fake):
    """Build a multi-version OTU history through real data-layer mutations.

    The change records come from the same producer production uses, so they can drift
    from real behaviour no more than the OTU data layer itself does. The OTU passes
    through five versions:

    * ``0`` -- created
    * ``1`` -- an isolate added
    * ``2`` -- a sequence added to the isolate
    * ``3`` -- renamed
    * ``4`` -- the isolate removed
    * ``removed`` -- the OTU removed (only when ``remove`` is ``True``)

    Returns the id of the OTU the mutations created so callers address it rather than a
    hand-picked literal id.
    """

    async def func(remove: bool) -> str:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "8816-v2",
            user.id,
        )

        await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "KX269872",
            "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene",
            "TGTTTAAGAGATTAAACAACCGCTTTC",
            user.id,
            host="sweet cherry",
        )

        await data_layer.otus.update(
            otu.id,
            UpdateOTURequest(name="Test Virus"),
            user.id,
        )

        await data_layer.otus.remove_isolate(otu.id, isolate.id, user.id)

        if remove:
            await data_layer.otus.remove(otu.id, user.id)

        return otu.id

    return func
