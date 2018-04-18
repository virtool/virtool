import virtool.errors
import virtool.kinds


def format_fasta_entry(kind_name, isolate_name, sequence_id, sequence):
    """
    Create a FASTA header for a sequence in a kind DNA FASTA file downloadable from Virtool.

    :param kind_name: the kind name to include in the header
    :type kind_name: str

    :param isolate_name: the isolate name to include in the header
    :type isolate_name: str

    :param sequence_id: the sequence id to include in the header
    :type sequence_id: str

    :param sequence: the sequence for the FASTA entry
    :type sequence: str

    :return: a FASTA entry
    :rtype: str

    """
    return ">{}|{}|{}|{}\n{}".format(kind_name, isolate_name, sequence_id, len(sequence), sequence)


def format_fasta_filename(*args):
    """
    Format a FASTA filename of the form "kind.isolate.sequence_id.fa".

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


async def generate_isolate_fasta(db, kind_id, isolate_id):
    """
    Generate a FASTA filename and body for the sequences associated with the isolate identified by the passed
    ``kind_id`` and ``isolate_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_id: the id of the isolates' parent kind
    :type kind_id: str

    :param isolate_id: the id of the isolate to FASTAfy
    :type isolate_id: str

    :return: as FASTA filename and body
    :rtype: Tuple[str, str]

    """
    kind_name, isolate_name = await get_kind_and_isolate_names(db, kind_id, isolate_id)

    kind = await db.kinds.find_one({"_id": kind_id, "isolates.id": isolate_id}, ["name", "isolates"])

    fasta = list()

    async for sequence in db.sequences.find({"kind_id": kind_id, "isolate_id": isolate_id}, ["sequence"]):
        fasta.append(format_fasta_entry(
            kind["name"],
            isolate_name,
            sequence["_id"],
            sequence["sequence"]
        ))

    return format_fasta_filename(kind["name"], isolate_name), "\n".join(fasta)


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
    sequence = await db.sequences.find_one(sequence_id, ["sequence", "kind_id", "isolate_id"])

    if not sequence:
        return None

    kind_name, isolate_name = await get_kind_and_isolate_names(db, sequence["kind_id"], sequence["isolate_id"])

    fasta = format_fasta_entry(
        kind_name,
        isolate_name,
        sequence_id,
        sequence["sequence"]
    )

    return format_fasta_filename(kind_name, isolate_name, sequence["_id"]), fasta


async def generate_kind_fasta(db, kind_id):
    """
    Generate a FASTA filename and body for the sequences associated with the kind identified by the passed
    ``kind_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_id: the id of the kind whose sequences should be FASTAfied
    :type kind_id: str

    :return: as FASTA filename and body
    :rtype: Tuple[str, str]

    """

    kind = await db.kinds.find_one(kind_id, ["name", "isolates"])

    if not kind:
        return None

    fasta = list()

    for isolate in kind["isolates"]:
        async for sequence in db.sequences.find({"isolate_id": isolate["id"]}, ["sequence"]):
            fasta.append(format_fasta_entry(
                kind["name"],
                virtool.kinds.format_isolate_name(isolate),
                sequence["_id"],
                sequence["sequence"]
            ))

    fasta = "\n".join(fasta)

    return format_fasta_filename(kind["name"]), fasta


async def get_kind_and_isolate_names(db, kind_id, isolate_id):

    kind = await db.kinds.find_one({"_id": kind_id, "isolates.id": isolate_id}, ["name", "isolates"])

    if not kind:
        raise virtool.errors.DatabaseError("Kind does not exist")

    isolate = virtool.kinds.find_isolate(kind["isolates"], isolate_id)

    if not isolate:
        raise virtool.errors.DatabaseError("Isolate does not exist")

    return kind["name"], virtool.kinds.format_isolate_name(isolate)
