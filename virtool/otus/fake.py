from dataclasses import dataclass
from typing import List

from virtool.fake.wrapper import FakerWrapper
from virtool.otus.data import OTUData
from virtool.types import App

SEQUENCE = """
GTATTTTTACAACAATTACCAACAACAACAAACAACAAACAACATTACAATTACTATTTACAATTACAATGGCATACACACAGACAGCTACCACATCAG
CTTTGCTGGACACTGTCCGAGGAAACAACTCCTTGGTCAATGATCTAGCAAAGCGTCGTCTTTACGACACAGCGGTTGAAGAGTTTAACGCTCGTGACC
GCAGGCCCAAGGTGAACTTTTCAAAAGTAATAAGCGAGGAGCAGACGCTTATTGCTACCCGGGCGTATCCAGAATTCCAAATTACATTTTATAACACGC
AAAATGCCGTGCATTCGCTTGCAGGTGGATTGCGATCTTTAGAACTGGAATATCTGATGATGCAAATTCCCTACGGATCATTGACTTATGACATAGGCG
GGAATTTTGCATCGCATCTGTTCAAGGGACGAGCATATGTACACTGCTGCATGCCCAACCTGGACGTTCGAGACATCATGCGGCACGAAGGCCAGAAAG
ACAGTATTGAACTATACCTTTCTAGGCTAGAGAGAGGGGGGAAAACAGTCCCCAACTTCCAAAAGGAAGCATTTGACAGATACGCAGAAATTCCTGAAG
ACGCTGTCTGTCACAATACTTTCCAGACAATGCGACATCAGCCGATGCAGCAATCAGGCAGAGTGTATGCCATTGCGCTACACAGCATATATGACATAC
CAGCCGATGAGTTCGGGGCGGCACTCTTGAGGAAAAATGTCCATACGTGCTATGCCGCTTTCCACTTCTCTGAGAACCTGCTTCTTGAAGATTCATACG
TCAATTTGGACGAAATCAACGCGTGTTTTTCGCGCGATGGAGACAAGTTGACCTTTTCTTTTGCATCAGAGAGTACTCTTAATTATTGTCATAGTTATT
CTAATATTCTTAAGTATGTGTGCAAAACTTACTTCCCGGCCTCTAATAGAGAGGTTTACATGAAGGAGTTTTTAGTCACCAGAGTTAATACCTGGTTTT
GTAAGTTTTCTAGAATAGATACTTTTCTTTTGTACAAAGGTGTGGCCCATAAAAGTGTAGATAGTGAGCAGTTTTATACTGCAATGGAAGACGCATGGC
ATTACAAAAAGACTCTTGCAATGTGCAACAGCGAGAGAATCCTCCTTGAGGATTCATCATCAGTCAATTACTGGTTTCCCAAAATGAGGGATATGGTCA
TCGTACCATTATTCGACATTTCTTTGGAGACTAGTAAGAGGACGCGCAAGGAAGTCTTAGTGTCCAAGGATTTCGTGTTTACAGTGCTTAACCACATTC
GAACATACCAGGCGAAAGCTCTTACATACGCAAATGTTTTGTCCTTTGTCGAATCGATTCGATCGAGGGTAATCATTAACGGTGTGACAGCGAGGTCCG
AATGGGATGTGGACAAATCTTTGTTACAATCCTTGTCCATGACGTTTTACCTGCATACTAAGCTTGCCGTTCTAAAGGATGACTTACTGATTAGCAAGT
TTAGTCTCGGTTCGAAAACGGTGTGCCAGCATGTGTGGGATGAGATTTCGCTGGCGTTTGGGAACGCATTTCCCTCCGTGAAAGAGAGGCTCTTGAACA
GGAAACTTATCAGAGTGGCAGGCGACGCATTAGAGATCAGGGTGCCTGATCTATATGTGACCTTCCACGACAGATTAGTGACTGAGTACAAGGCCTCTG
TGGACATGCCTGCGCTTGACATTAGGAAGAAGATGGAAGAAACGGAAGTGATGTACAATGCACTTTCAGAGTTATCGGTGTTAAGGGAGTCTGACAAAT
TCGATGTTGATGTTTTTTCCCAGATGTGCCAATCTTTGGAAGTTGACCCAATGACGGCAGCGAAGGTTATAGTCGCGGTCATGAGCAATGAGAGCGGTC
TGACTCTCACATTTGAACGACCTACTGAGGCGAATGTTGCGCTAGCTTTACAGGATCAAGAGAAGGCTTCAGAAGGTGCTTTGGTAGTTACCTCAAGAG
AAGTTGAAGAACCGTCCATGAAGGGTTCGATGGCCAGAGGAGAGTTACAATTAGCTGGTCTTGCTGGAGATCATCCGGAGTCGTCCTATTCTAAGAACG
GCCAGCAGTTGATCAGTACAGACACATGATTAAAGCACAACCCAAGCAAAAATTGGACACTTCAATCCAAACGGAGTACCCGGCTTTGCAGACGATTGT
"""


@dataclass
class FakeSequence:
    accession: str
    definition: str
    sequence: str


class FakeOTU:
    def __init__(self, app: App, ref_id: str, user_id: str, document: dict):
        self._app = app
        self._data = OTUData(app)
        self._ref_id = ref_id
        self._user_id = user_id
        self._document = document

        self.otu_id = document["id"]
        self._faker: FakerWrapper = self._app["fake"]

    async def add_isolate(
        self, source_type, source_name, sequences: List[FakeSequence]
    ):
        isolate_id = self._faker.get_mongo_id()

        await self._data.add_isolate(
            self.otu_id,
            source_type,
            source_name,
            self._user_id,
            isolate_id=isolate_id,
        )

        for sequence in sequences:
            await self._data.create_sequence(
                self.otu_id,
                isolate_id,
                sequence.accession,
                sequence.definition,
                sequence.sequence,
                self._user_id,
                sequence_id=self._faker.get_mongo_id(),
            )


class FakeOTUCreator:
    def __init__(self, app: App, ref_id: str, user_id: str):
        self._app = app
        self._faker = app["fake"]
        self._ref_id = ref_id
        self._user_id = user_id

    async def create(self, name: str, abbreviation: str):
        otu_data = OTUData(self._app)

        document = await otu_data.create(
            self._ref_id,
            name,
            self._user_id,
            abbreviation=abbreviation,
            otu_id=self._faker.get_mongo_id(),
        )

        return FakeOTU(self._app, self._ref_id, self._user_id, document)


async def create_fake_otus(app: App, ref_id: str, user_id: str):
    """
    Create a set of fake OTUs to populate the reference identified by ``ref_id``.

    :param app: the application object
    :param ref_id: the parent reference ID
    :param user_id: the ID of the user creating the OTUs

    """
    fake_otu_creator = FakeOTUCreator(app, ref_id, user_id)

    abtv = await fake_otu_creator.create("Abaca bunchy top virus", "ABTV")

    await abtv.add_isolate(
        "Isolate",
        "A",
        [
            FakeSequence("foo", "ABTV sequence 1", SEQUENCE),
            FakeSequence("foo", "ABTV sequence 2", SEQUENCE),
            FakeSequence("foo", "ABTV sequence 3", SEQUENCE),
            FakeSequence("foo", "ABTV sequence 4", SEQUENCE),
            FakeSequence("foo", "ABTV sequence 5", SEQUENCE),
        ],
    )

    aspv = await fake_otu_creator.create("Apple stem pitting virus", "ASPV")

    await aspv.add_isolate(
        "Isolate", "Z", [FakeSequence("bar", "ASPV sequence 1", SEQUENCE)]
    )

    tmv = await fake_otu_creator.create("Tobacco mosaic virus", "TMV")

    await tmv.add_isolate(
        "Isolate", "1", [FakeSequence("bar", "TMV sequence 1", SEQUENCE)]
    )
    await tmv.add_isolate(
        "Isolate", "2", [FakeSequence("baz", "TMV sequence 1", SEQUENCE)]
    )

    lchv_1 = await fake_otu_creator.create("Little cherry virus 1", "LChV1")

    await lchv_1.add_isolate(
        "Isolate", "A", [FakeSequence("bar", "LChV1 sequence 1", SEQUENCE)]
    )
    await lchv_1.add_isolate(
        "Isolate", "B", [FakeSequence("baz", "LChV1 sequence 1", SEQUENCE)]
    )
    await lchv_1.add_isolate(
        "Isolate", "C", [FakeSequence("bat", "LChV1 sequence 1", SEQUENCE)]
    )

    return [abtv._document, aspv._document, tmv._document, lchv_1._document]
