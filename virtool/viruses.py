import os
import re
import json
import gzip
import logging
import pymongo
import pymongo.errors
import pymongo.collection

from copy import deepcopy
from virtool.data_utils import format_doc_id
from virtool.utils import random_alphanumeric


logger = logging.getLogger(__name__)


dispatch_projection = [
    "_id",
    "version",
    "name",
    "modified",
    "abbreviation"
]


def processor(document):
    return format_doc_id("virus", dict(document))


def dispatch_processor(document):
    return processor(document)


async def join(db, virus_id, document=None):
    """
    Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
    database will not be queried for the virus based on its id.
    
    :param db: a database client

    :param virus_id: the id of the virus to join.
    :type virus_id: str

    :param document: use this virus document as a basis for the join instead finding it using the virus id.
    :type document: dict

    :return: the joined virus document
    :rtype: dict

    """
    # Get the virus entry if a virus parameter was not passed.
    document = document or await db.viruses.find_one(virus_id)

    if document is None:
        return None

    # Extract the isolate_ids associated with the virus.
    isolate_ids = extract_isolate_ids(document)

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"isolate_id": {"$in": isolate_ids}}).to_list(None) or []

    # Merge the sequence entries into the virus entry.
    return merge_virus(document, sequences)


async def check_name_and_abbreviation(db, name=None, abbreviation=None):
    unique_name = not (name and await db.viruses.find({"name": re.compile(name, re.IGNORECASE)}).count())
    unique_abbreviation = not (abbreviation and await db.viruses.find({"abbreviation": abbreviation}).count())

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


def set_default_isolate(db, virus_id, isolate_id):
    """
    Sets the isolate with the passed isolate id as the default isolate. Removes the default flag from the previous
    default isolate.

    :param virus_id: the Transaction object generated from the client request.
    :type virus_id: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and the isolate id of the old and new default isolates.
    :rtype: tuple

    """
    data = transaction.data

    # Get a list of the current isolates for a virus.
    isolates = yield self.get_field(data["_id"], "isolates")

    old_default = None

    # Set the default key to True for the supplied data["isolate_id"]. Set all of the other isolates' default
    # keys to False,
    for isolate in isolates:
        # Save the id of the old default isolate.
        if isolate["default"]:
            old_default = isolate["isolate_id"]

        # Set the new default isolate.
        isolate["default"] = isolate["isolate_id"] == data["isolate_id"]

    assert old_default is not None

    old, new = yield self.update(data["_id"], {
        "$set": {
            "isolates": isolates,
            "modified": True
        }
    }, return_change=True)

    yield self.collections["history"].add(
        "update",
        "set_default_isolate",
        old,
        new,
        transaction.connection.user["_id"]
    )

    return True, {
        "old_default": old_default,
        "new_default": data["isolate_id"],
        "virus_id": data["_id"]
    }


def verify_virus(self, transaction):
    """
    Takes a virus id passed by the client and verifies that the associated virus is ready to be included in an
    index rebuild.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a dict describing any verification errors.
    :rtype: tuple

    """
    data = transaction.data

    # Get the virus document of interest.
    virus = yield self.find_one({"_id": data["_id"]})

    # Extract the isolate ids from the virus.
    isolate_ids = virusutils.extract_isolate_ids(virus)

    # Get the sequences associated with the virus isolates.
    sequences = yield self.sequences_collection.find({"isolate_id": {"$in": isolate_ids}}).to_list(None)

    # Verify the virus, returning any verification errors.
    verification_errors = yield virusutils.check_virus(virus, sequences)

    if not verification_errors:
        old, new = yield self.update(data["_id"], {
            "$set": {
                "modified": False
            }
        }, return_change=True)

        yield self.collections["history"].add(
            "update",
            "verify_virus",
            old,
            new,
            transaction.connection.user["_id"]
        )

        return True, None

    return False, verification_errors


def fetch_ncbi(self, transaction):
    """
    Takes an NCBI accession number and gets the associated Genbank entry from NCBI. Converts the Genbank data into
    a Virtool-style sequence document and returns it to the client.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a sequence dict created from the Genbank data.
    :rtype: tuple

    """
    seq_dict = yield virusutils.get_from_ncbi(transaction.data["accession"])

    if seq_dict:
        return True, seq_dict

    return False, None


def add_sequence(self, transaction):
    """
    Adds a new sequence to a virus isolate with given virus and isolate ids.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a the update response.
    :rtype: tuple

    """
    old_virus, sequence = yield self.prepare_sequences(
        transaction.data["_id"].strip(),
        transaction.data["new"]
    )

    try:
        response = yield self.sequences_collection.insert(sequence)
    except pymongo.errors.DuplicateKeyError:
        return False, dict(message="Accession already exists.")

    yield self.complete_sequence_upsert(
        old_virus,
        sequence["isolate_id"],
        transaction.connection.user["_id"],
        add=True
    )

    return True, response


def update_sequence(self, transaction):
    """
    Updates an existing sequence in a isolate and virus with given ids. Takes a dict of changes to apply to the
    sequence document.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a the update response.
    :rtype: tuple

    """
    old_virus, sequence = yield self.prepare_sequences(
        transaction.data["_id"],
        transaction.data["new"]
    )

    sequence_id = sequence.pop("_id")

    response = yield self.sequences_collection.update({"_id": sequence_id}, {"$set": sequence})

    yield self.complete_sequence_upsert(
        old_virus,
        sequence["isolate_id"],
        transaction.connection.user["_id"]
    )

    return True, response


def remove_sequence(self, transaction):
    """
    Removes a sequence from the sequence collection and from its associated virus document. Takes virus id,
    isolate id, and the sequence id to be removed.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a the remove method's response.
    :rtype: tuple

    """
    old = yield self.join(transaction.data["_id"])

    # Remove the sequence document.
    response = yield self.sequences_collection.remove({"_id": transaction.data["sequence_id"]})

    # Update the virus document, decrementing the sequence_count by one and setting the modified flag.
    yield self.update(transaction.data["_id"], {
        "$set": {"modified": True}
    })

    new = yield self.join(transaction.data["_id"])

    yield self.collections["history"].add(
        "update",
        "remove_sequence",
        old,
        new,
        transaction.connection.user["_id"]
    )

    return True, response


def export_file(self):
    """
    Removes a sequence from the sequence collection and from its associated virus document. Takes virus id,
    isolate id, and the sequence id to be removed.

    :return: a tuple containing a bool indicating success and a the generated file's id and size.
    :rtype: tuple

    """
    # A list of joined viruses.
    virus_list = list()

    cursor = self.find()

    while (yield cursor.fetch_next):
        virus = cursor.next_object()

        if virus["last_indexed_version"] is not None:
            # Join the virus document with its associated sequence documents.
            joined = yield self.join(virus["_id"], virus)

            # If the virus has been changed since the last index rebuild, patch it to its last indexed version.
            if virus["_version"] != virus["last_indexed_version"]:
                _, joined, _ = yield self.collections["history"].patch_virus_to_version(
                    joined,
                    virus["last_indexed_version"]
                )

            virus_list.append(joined)

    # Convert the list of viruses to a JSON-formatted string.
    json_string = json.dumps(virus_list)

    # Compress the JSON string with gzip.
    body = gzip.compress(bytes(json_string, "utf-8"))

    # Register the file content with the file manager. The file manager will write the content to a file and make
    # it available for download. It returns a file_id that will be passed back to the client so it can send in a
    # request to download the file.
    file_id = yield self.collections["files"].register("viruses.json.gz", body, "json")

    return True, {
        "filename": file_id,
        "size": os.path.getsize(self.settings.get("data_path") + "/download/" + file_id)
    }


def import_file(self, transaction):
    """
    Import virus data from an uploaded json.gz file identified by a file_id passed in ``transaction``.

    :param transaction: the Transaction object generated from the client request.
    :type transaction: :class:`~.dispatcher.Transaction`

    :return: a tuple containing a bool indicating success and a the number of viruses and isolates added.
    :rtype: tuple

    """
    # The file id to import the data from.
    file_id = transaction.data.pop("file_id")
    replace = transaction.data.pop("replace")

    viruses = yield virusutils.read_import_file(os.path.join(self.settings.get("data_path"), "files", file_id))

    virus_count = len(viruses)

    duplicates, errors = yield virusutils.verify_virus_list(viruses)

    if duplicates or errors:
        return False, dict(message="Invalid import file", duplicates=duplicates, errors=errors)

    # Keeps track of the progress of the import process. Sent to the client intermittently.
    counter = {
        "progress": 0,
        "added": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": list()
    }

    # Make a list of virus names that are already in use in the database. Force them all to lowercase for
    # case-insensitive comparison of existing viruses to those being imported.
    used_names = yield self.db.distinct("lower_name")

    empty_collection = len(used_names) == 0

    conflicts = yield self.find_import_conflicts(viruses, replace)

    if conflicts:
        return False, dict(message="Conflicting sequence ids", conflicts=conflicts)

    used_isolate_ids = yield self.db.distinct("isolates.isolate_id")
    used_isolate_ids = set(used_isolate_ids)

    base_virus_document = {
        "_version": 0,
        "last_indexed_version": 0,
        "modified": False,
        "username": transaction.connection.user["_id"],
        "imported": True
    }

    # Lists of pending dispatches. These are sent in batches of ten to avoid overwhelming browsers.
    adds = list()
    replaces = list()

    for i, virus in enumerate(viruses):
        # Calculate the overall progress (how many viruses in the import document have been processed?)
        progress = round((i + 1) / virus_count, 3)

        # Send the current progress data in ``counter`` to the client if the progress has increased by at least
        # 2% since the last report.
        if progress - counter["progress"] > 0.02:
            counter["progress"] = progress
            transaction.update(counter)

        virus_document, sequences = virtool.virusutils.split_virus(virus)

        to_insert = dict(base_virus_document)

        to_insert.update({key: virus_document[key] for key in ["name", "abbreviation", "isolates"]})

        if empty_collection:
            to_insert["_id"] = yield self.get_new_id()

            dispatches = yield self.insert_from_import(to_insert)

            adds.append(dispatches)

            for sequence_document in sequences:
                yield self.sequences_collection.insert(sequence_document)

            counter["added"] += 1

            yield self.send_import_dispatches(adds, replaces)

            continue

        lower_name = virus["name"].lower()

        virus_exists = lower_name in used_names

        if virus_exists and not replace:
            counter["skipped"] += 1
            continue

        to_insert["_id"] = yield self.get_new_id()

        # Check if abbreviation exists already.
        virus_with_abbreviation = None

        # Don't count empty strings as duplicate abbreviations!
        if virus["abbreviation"]:
            virus_with_abbreviation = yield self.find_one({"abbreviation": virus["abbreviation"]})

        if virus_with_abbreviation and virus_with_abbreviation["lower_name"] != lower_name:
            # Remove the imported virus's abbreviation because it is already assigned to an existing virus.
            virus["abbreviation"] = ""

            # Record a message for the user.
            counter["warnings"].append(
                "Abbreviation {} already existed for virus {} and was not assigned to new virus {}.".format(
                    virus_with_abbreviation["abbreviation"], virus_with_abbreviation["name"], virus["name"]
                )
            )

        virus_document, sequences = virusutils.split_virus(virus)

        # Loops through each isolate in the imported virus.
        for isolate in virus_document["isolates"]:
            # Check if the isolate id is already used in the viruses collection.
            if isolate["isolate_id"] in used_isolate_ids:
                # Generate a new isolate id if the imported isolate id is already in the viruses collection.
                isolate["isolate_id"] = yield self.get_new_isolate_id(used_isolate_ids)

                # Append the generated isolate to a list of used isolate ids so that is isn't reused during the
                # import process.
                used_isolate_ids.add(isolate["isolate_id"])

        if virus_exists:
            existing_virus = yield self.find_one({"lower_name": lower_name})

            isolate_ids = virtool.virusutils.extract_isolate_ids(existing_virus)

            # Remove the existing virus, including its sequences.
            remove_dispatches = yield self.remove_for_import(
                existing_virus["_id"],
                transaction.connection.user["_id"]
            )

            # Remove all sequence documents associated with the existing virus.
            yield self.sequences_collection.remove({"_id": {
                "$in": isolate_ids
            }})

            counter["replaced"] += 1

        to_insert.update({key: virus_document[key] for key in ["abbreviation", "name", "isolates"]})

        # Add the new virus.
        insert_dispatches = yield self.insert_from_import(to_insert)

        if virus_exists:
            replaces.append((remove_dispatches, insert_dispatches))
        else:
            adds.append(insert_dispatches)

        for sequence_document in sequences:
            yield self.sequences_collection.insert(sequence_document)

        if not virus_exists:
            counter["added"] += 1

        self.send_import_dispatches(adds, replaces)

    yield self.send_import_dispatches(adds, replaces, flush=True)

    counter["progress"] = 1
    transaction.update(counter)

    return True, counter


def find_import_conflicts(self, viruses, replace):
    used_names = yield self.db.distinct("lower_name")

    conflicts = list()

    for virus in viruses:
        lower_name = virus["name"].lower()

        # Check if the virus to be imported already exists in the database using a case-insensitive name comparison.
        virus_exists = lower_name in used_names

        # A list of sequence ids that will be imported along with the virus.
        sequence_ids_to_import = yield virtool.virusutils.extract_sequence_ids(virus)

        # Sequences that already exist in the database and have the same ids as some sequences to be imported.
        already_existing_sequences = yield self.sequences_collection.find(
            {"_id": {"$in": sequence_ids_to_import}},
            ["_id", "isolate_id"]
        ).to_list(length=None)

        if virus_exists:
            # Continue to the next virus if this one cannot be applied to the database.
            if not replace:
                continue

            # The full document of the existing virus.
            existing_virus = yield self.find_one(
                {"lower_name": lower_name},
                ["_id", "name", "isolates"]
            )

            # The isolate ids in the existing virus document.
            existing_isolate_ids = virtool.virusutils.extract_isolate_ids(existing_virus)

            for sequence in already_existing_sequences:
                if not sequence["isolate_id"] in existing_isolate_ids:
                    conflicts.append((existing_virus["_id"], existing_virus["name"], sequence["_id"]))

        else:
            # The virus doesn't already exist but some of its sequence ids are already assigned to other viruses.
            # This is a problem.
            for sequence in already_existing_sequences:
                existing_virus = yield self.find_one({"isolates.isolate_id": sequence["isolate_id"]})
                conflicts.append((existing_virus["_id"], existing_virus["name"], sequence["_id"]))

    return conflicts or None


def send_import_dispatches(self, adds, replaces, flush=False):
    if len(adds) == 30 or flush:
        yield self.dispatch("update", [add[0] for add in adds])
        yield self.collections["history"].dispatch("insert", [add[1] for add in adds])

        del adds[:]

    if len(replaces) == 30 or flush:
        yield self.dispatch("remove", [replace[0][0] for replace in replaces])
        yield self.collections["history"].dispatch("insert", [replace[0][1] for replace in replaces])

        yield self.dispatch("update", [replace[1][0] for replace in replaces])
        yield self.collections["history"].dispatch("insert", [replace[1][1] for replace in replaces])

        del replaces[:]


def insert_from_import(self, virus):
    virus.update({
        "_version": 0,
        "lower_name": virus["name"].lower()
    })

    # Perform the actual database insert operation, retaining the response.
    yield self.db.insert(virus)

    logger.debug("Imported virus {}".format(virus["name"]))

    to_dispatch_virus = yield self.sync_processor([{key: virus[key] for key in self.sync_projector}])

    joined = yield self.join(virus["_id"])

    to_dispatch_history = yield self.collections["history"].add_for_import(
        "insert",
        "add",
        None,  # there is no old document
        joined,
        virus["username"]
    )

    return to_dispatch_virus[0], to_dispatch_history


def remove_for_import(self, virus_id, username):
    # Join the virus.
    virus = yield self.join(virus_id)

    if not virus:
        raise ValueError("No virus associated with _id {}".format(virus_id))

    # Get all the isolate ids from the
    isolate_ids = virusutils.extract_isolate_ids(virus)

    # Remove all sequences associated with the isolates.
    yield self.sequences_collection.remove({"isolate_id": {"$in": isolate_ids}})

    yield self.db.remove({"_id": virus_id})

    # Put an entry in the history collection saying the virus was removed.
    to_dispatch_history = yield self.collections["history"].add_for_import(
        "remove",
        "remove",
        virus,
        None,
        username
    )

    return virus_id, to_dispatch_history


def update(self, virus_id, update, increment_version=True, return_change=False, upsert=False):
    """
    A wrapper around the database.Collection superclass 'update' method. Adds functionality for easily getting
    joined virus document before and after that update is applied.

    :param virus_id: the document id or query to used to direct the update.
    :type virus_id: str

    :param update: an update dict in Pymongo vernacular.
    :type update: dict

    :param increment_version: should the document version be incremented.
    :type increment_version: bool

    :param return_change: should the method create and return the old and new documents.
    :type return_change: bool

    :return: a tuple containing the old and new documents.
    :rtype: tuple

    """
    # Get the current entry from the virus collection.
    old_doc = None
    new_doc = None

    if return_change:
        old_doc = yield self.join(virus_id)

    yield super().update(virus_id, update, increment_version=increment_version)

    # Get the new entry.
    if return_change:
        new_doc = yield self.join(virus_id)

    return old_doc, new_doc


def set_last_indexed_version(self, data):
    """
    Called as a result of a request from the index rebuild job. Updates the last indexed version and _version fields
    of all viruses involved in the rebuild when the build completes.

    :param data: the new last_indexed_version and _version fields.
    :return: the response from the update call.

    """
    response = yield self.update({"_id": {"$in": data["ids"]}}, {
        "$set": {
            "last_indexed_version": data["version"],
            "_version": data["version"]
        }
    }, increment_version=False)

    return response


def prepare_sequences(self, virus_id, sequence):
    """
    Called when a add_sequence or update_sequence are called. Returns a tweaked version of the new sequence or
    update and the joined virus associated with the supplied virus id.

    :param virus_id: the id of the virus to get a joined document for.
    :param sequence: the sequence dict to add or update.
    :return: the joined virus and tweaked sequence dict.

    """
    # Remove all whitespace from the sequence string in the sequence dict.
    sequence.update({
        "sequence": "".join(sequence["sequence"].split()),
        "annotated": True
    })

    virus = yield self.join(virus_id)

    return virus, sequence


def complete_sequence_upsert(self, old_document, isolate_id, username, add=False):
    """
    Called by both the :any:`add_sequence` and :any:`update_sequence` methods. Adds information about a new or
    updated sequence to the viruses collection and adds a history record for the change.

    :param old_document: the joined virus before the change.
    :param isolate_id: the id of the isolate that the sequence belongs to.
    :param username: the username performing the operation.
    :param add: the sequence is a new sequence not an update.
    :return: the Mongo update response.

    """
    update = {"$set": {"modified": True}}

    # If a new sequence is being added, increment its associated isolate's sequence_count field by one.
    if add:
        isolates = yield self.get_field(old_document["_id"], "isolates")

        for isolate in isolates:
            if isolate["isolate_id"] == isolate_id:
                break

        # Modify the update dict so the isolate list is updated.
        update["$set"]["isolates"] = isolates

    # Set the virus modified flag and update the isolate list if necessary.
    response = yield self.update(old_document["_id"], update)

    # Get the new joined
    new_document = yield self.join(old_document["_id"])

    yield self.collections["history"].add(
        "update",
        "add_sequence" if add else "update_sequence",
        old_document,
        new_document,
        username
    )

    return response


async def get_new_isolate_id(db, used_isolate_ids=None):
    """
    Generates a unique isolate id.
    
    """
    used_isolate_ids = used_isolate_ids or list()

    used_isolate_ids += await db.viruses.distinct("isolates.isolate_id")

    return random_alphanumeric(8, excluded=set(used_isolate_ids))


def merge_virus(virus, sequences):
    """
    Merge the given sequences in the given virus document. The virus will gain a ``sequences`` field containing a list
    of its associated sequence documents.

    :param virus: a virus document.
    :type virus: dict

    :param sequences: the sequence documents to merge into the virus.
    :type sequences: list

    :return: the merged virus.
    :rtype: dict

    """
    for isolate in virus["isolates"]:
        isolate["sequences"] = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]

    return virus


def split_virus(virus):
    """
    Split a merged virus document into a list of sequence documents associated with the virus and a regular virus
    document containing no sequence subdocuments.

    :param virus: the merged virus to split
    :type virus: dict

    :return: a tuple containing the new virus document and a list of sequence documents
    :type: tuple

    """
    sequences = list()

    virus_document = deepcopy(virus)

    for isolate in virus_document["isolates"]:
        sequences += isolate.pop("sequences")

    return virus_document, sequences


def extract_isolate_ids(virus):
    """
    Get the isolate ids from a virus document.

    :param virus: a virus document.
    :return: a list of isolate ids.

    """
    return [isolate["isolate_id"] for isolate in virus["isolates"]]


