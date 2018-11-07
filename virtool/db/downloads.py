import virtool.errors
import virtool.otus


def format_fasta_entry(otu_name, isolate_name, sequence_id, sequence):
    """
    Create a FASTA header for a sequence in a otu DNA FASTA file downloadable from Virtool.

    :param otu_name: the otu name to include in the header
    :type otu_name: str

    :param isolate_name: the isolate name to include in the header
    :type isolate_name: str

    :param sequence_id: the sequence id to include in the header
    :type sequence_id: str

    :param sequence: the sequence for the FASTA entry
    :type sequence: str

    :return: a FASTA entry
    :rtype: str

    """
    return ">{}|{}|{}|{}\n{}".format(otu_name, isolate_name, sequence_id, len(sequence), sequence)


def format_fasta_filename(*args):
    """
    Format a FASTA filename of the form "otu.isolate.sequence_id.fa".

    :param args: the filename parts

    :return: a compound FASTA filename
    :rtype: str

    """
    if len(args) > 3:
        raise ValueError("Unexpected number of filename parts")

    if len(args) == 0:
        raise ValueError("At least one filename part required")

    filename = ".".join(args).replace(" ", "_") + ".fa"

    return filename.lower()


async def generate_isolate_fasta(db, otu_id, isolate_id):
    """
    Generate a FASTA filename and body for the sequences associated with the isolate identified by the passed
    ``otu_id`` and ``isolate_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param otu_id: the id of the isolates' parent otu
    :type otu_id: str

    :param isolate_id: the id of the isolate to FASTAfy
    :type isolate_id: str

    :return: as FASTA filename and body
    :rtype: Tuple[str, str]

    """
    _, isolate_name = await get_otu_and_isolate_names(db, otu_id, isolate_id)

    otu = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["name", "isolates"])

    fasta = list()

    async for sequence in db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, ["sequence"]):
        fasta.append(format_fasta_entry(
            otu["name"],
            isolate_name,
            sequence["_id"],
            sequence["sequence"]
        ))

    return format_fasta_filename(otu["name"], isolate_name), "\n".join(fasta)


async def generate_sequence_fasta(db, sequence_id):
    """
    Generate a FASTA filename and body for the sequence associated with the passed ``sequence_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param sequence_id: the id sequence of the sequence to FASTAfy
    :type sequence_id: str

    :return: as FASTA filename and body
    :rtype: Tuple[str, str]

    """
    sequence = await db.sequences.find_one(sequence_id, ["sequence", "otu_id", "isolate_id"])

    if not sequence:
        raise virtool.errors.DatabaseError("Sequence does not exist")

    otu_name, isolate_name = await get_otu_and_isolate_names(db, sequence["otu_id"], sequence["isolate_id"])

    fasta = format_fasta_entry(
        otu_name,
        isolate_name,
        sequence_id,
        sequence["sequence"]
    )

    return format_fasta_filename(otu_name, isolate_name, sequence["_id"]), fasta


async def generate_otu_fasta(db, otu_id):
    """
    Generate a FASTA filename and body for the sequences associated with the otu identified by the passed
    ``otu_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param otu_id: the id of the otu whose sequences should be FASTA-fied
    :type otu_id: str

    :return: as FASTA filename and body
    :rtype: Tuple[str, str]

    """

    otu = await db.otus.find_one(otu_id, ["name", "isolates"])

    if not otu:
        raise virtool.errors.DatabaseError("OTU does not exist")

    fasta = list()

    for isolate in otu["isolates"]:
        async for sequence in db.sequences.find({"otu_id": otu_id, "isolate_id": isolate["id"]}, ["sequence"]):
            fasta.append(format_fasta_entry(
                otu["name"],
                virtool.otus.format_isolate_name(isolate),
                sequence["_id"],
                sequence["sequence"]
            ))

    fasta = "\n".join(fasta)

    return format_fasta_filename(otu["name"]), fasta


async def get_otu_and_isolate_names(db, otu_id, isolate_id):
    otu = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["name", "isolates"])

    if not otu:
        raise virtool.errors.DatabaseError("OTU does not exist")

    isolate = virtool.otus.find_isolate(otu["isolates"], isolate_id)

    if not isolate:
        raise virtool.errors.DatabaseError("Isolate does not exist")

    return otu["name"], virtool.otus.format_isolate_name(isolate)
