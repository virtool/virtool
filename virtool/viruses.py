import motor
import re
import pymongo
import pymongo.errors
import logging
import json
import dictdiffer
import subprocess
import gzip
import os

from Bio import Entrez, SeqIO

import virtool.gen
import virtool.utils
import virtool.database

logger = logging.getLogger(__name__)


class Collection(virtool.database.SyncingCollection):

    """
    Viruses collection

    :param dispatcher: the dispatcher object that instantiated the collection.
    :type dispatcher: :class:`~.dispatcher.Dispatcher`

    """
    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("viruses", dispatch, collections, settings, add_periodic_callback)

        # Set what is sent to the client when syncing.
        self.sync_projector += ["name", "modified", "abbreviation"]

        # Contains documents describing viral sequences associated with viruses in the viruses collection. Changes to
        # sequence documents only occur by calling methods in this Collection object.
        self.sequences_collection = motor.MotorClient()[self.settings.get("db_name")]["sequences"]

    @virtool.gen.exposed_method(["add_virus"])
    def add(self, transaction):
        """
        Adds a new virus to the collection. Checks to make sure the supplied virus name and abbreviation are not
        already in use in the collection. Any errors are sent back to the client.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and data to pass back to the client.
        :rtype: tuple

        """
        data = transaction.data

        # Check to see if the submitted abbreviation already exists in the database. The check is case-sensitive. If
        # no abbreviation was submitted the count will be 0.
        abbreviation_count = 0

        # Get the number of occurrences of the abbreviation in the collection. Hopefully it is zero.
        if data["abbreviation"]:
            abbreviation_count = yield self.find({"abbreviation": data["abbreviation"]}).count()

        # Check how many times the virus name already exists in the database. Virus names must be unique.
        name_count = yield self.find({"name": re.compile(data["name"], re.IGNORECASE)}).count()

        # Only proceed with generating the entry if the name and abbreviation are not in use.
        if abbreviation_count == 0 and name_count == 0:
            # Generate a new unique id for the entry.
            virus_id = yield self.generate_virus_id()

            # Add some more data to the nascent virus document.
            data.update({
                "_id": virus_id,
                "isolates": list(),
                "modified": True,
                "last_indexed_version": None
            })

            response = yield self.insert_virus(data, transaction.connection.user["_id"])

            return True, response

        else:
            # Return a bool indicating an error occurred and a dict describing which errors occurred.
            return False, {
                "name": name_count > 0,
                "abbreviation": abbreviation_count > 0
            }

    @virtool.gen.exposed_method(["remove_virus"])
    def remove_virus(self, transaction):
        """
        Remove a virus document by its id. Also removes any associated sequence documents from the sequences
        collection and adds a record of the removal to the history collection.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and data to pass back to the client.
        :rtype: tuple

        """
        virus_id = transaction.data["_id"]

        if isinstance(virus_id, str):

            virus = yield self.join(virus_id)

            if virus:
                # Get all the isolate ids from the
                isolate_ids = yield extract_isolate_ids(virus)

                # Remove all sequences associated with the isolates.
                yield self.sequences_collection.remove({"isolate_id": {"$in": isolate_ids}})

                # Remove the virus document itself.
                response = yield super().remove(virus_id)

                # Put an entry in the history collection saying the virus was removed.
                yield self.collections["history"].add(
                    "remove",
                    "remove",
                    virus,
                    None,
                    transaction.connection.user["_id"]
                )

                return True, response
            else:
                logger.warning("User {} attempted to remove non-existent virus".format(
                    transaction.connection.user["_id"]
                ))
        else:
            logger.warning("User {} attempted to remove more than one virus in a single call".format(
                transaction.connection.user["_id"]
            ))

        return False, None

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        """
        Get the complete detailed data for the passed virus id. Joins the virus document with its associated
        sequence documents.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and the detailed data to send back to the client.
        :rtype: tuple

        """
        # Gather the virus document and associated documents from the sequences collection into one dict.
        # This will be sent to the client.
        detail = yield self.join(transaction.data["_id"])

        return True, detail

    @virtool.gen.exposed_method(["modify_virus"])
    def set_field(self, transaction):
        """
        Set either the abbreviation or name field in the virus document identified by the the supplied virus
        id. Checks that the abbreviation or name is not used elsewhere in the collection and adds a history document
        describing the change.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a dict describing any errors.
        :rtype: tuple

        """
        data = transaction.data
        user = transaction.connection.user

        if data["field"] in ["abbreviation", "name"]:
            existing_value_count = 0

            if data["value"]:
                existing_value_count = yield self.find({data["field"]: data["value"]}).count()

            if existing_value_count == 0:
                # Apply the update.
                old, new = yield self.update(data["_id"], {
                    "$set": {
                        data["field"]: data["value"],
                        "modified": True
                    }
                }, return_change=True)

                # Add a history record describing the change.
                yield self.collections["history"].add(
                    "update",
                    "set_field",
                    old,
                    new,
                    user["_id"]
                )

                # If the field is successfully set, complete the transaction successfully.
                return True, None

            # Return False to indicate the method failed and send a message to the client indicating that the supplied
            # field value already exists.
            return False, {"message": "already exists"}

        # Log a warning and return False to indicate the method failed.
        logger.warning("User {} attempted to change protected field".format(user["_id"]))
        return False, "Attempted to change protected field"

    @virtool.gen.exposed_method(["modify_virus"])
    def upsert_isolate(self, transaction):
        """
        Update or insert a virus isolate. If no isolate_id is included in the data passed from the client, a new isolate
        will be created.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a dict containing the id of the upserted isolate.
        :rtype: tuple

        """
        data = transaction.data

        new_isolate = data["new"]

        # All source types are stored in lower case.
        new_isolate["source_type"] = new_isolate["source_type"].lower()

        # Get the existing isolates from the database.
        isolates = yield self.get_field(data["_id"], "isolates")

        # Get the complete, joined entry before the update.
        old = yield self.join(data["_id"])

        # If the update dict contains an isolate id field, update the matching isolate in the virus document. The
        # provided isolate id must already exist in the virus, otherwise the method will fail.
        if "isolate_id" in new_isolate:
            isolate_id = new_isolate.pop("isolate_id")

            # Set to True when and if the included isolate id is found in the viruses isolates list.
            found_isolate_id = False

            # Go through the virus' isolates until a matching isolate id is found. If a match is not found.
            for isolate in isolates:
                if isolate["isolate_id"] == isolate_id:
                    isolate.update(new_isolate)
                    found_isolate_id = True
                    break

            # Check that the isolate id already exists in the virus, before updating.
            if found_isolate_id:
                yield self.update(data["_id"], {
                    "$set": {
                        "isolates": isolates,
                        "modified": True
                    }
                })

            # Fail if the isolate update contains an isolate id not found in the virus.
            else:

                logger.warning("User {} attempted to update isolate with non-existent isolate id".format(
                    transaction.connection.user["_id"]
                ))
                return False, {"error": "Invalid isolate id."}

        # If no isolate id is included in the upsert dict, we assume we are adding a new isolate.
        else:
            # Get a unique isolate_id for the new isolate.
            isolate_id = yield self.generate_isolate_id()

            # Set the isolate as the default isolate if it is the first one.
            new_isolate.update({
                "default": len(isolates) == 0,
                "isolate_id": isolate_id,
                "sequence_count": 0
            })

            # Push the new isolate to the database.
            yield self.update(data["_id"], {
                "$push": {"isolates": new_isolate},
                "$set": {"modified": True}
            })

        # Get the joined entry now that it has been updated.
        new = yield self.join(data["_id"])

        # Use the old and new entry to add a new history document for the change.
        yield self.collections["history"].add(
            "update",
            "upsert_isolate",
            old,
            new,
            transaction.connection.user["_id"]
        )

        return True, {"isolate_id": isolate_id}

    @virtool.gen.exposed_method(["modify_virus"])
    def remove_isolate(self, transaction):
        """
        Remove an isolate with the supplied isolate id from the virus document with the provided virus id.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and the id of the removed isolate and its virus.
        :rtype: tuple

        """
        data = transaction.data

        # Get the isolates associated with the supplied virus id.
        isolates = yield self.get_field(data["_id"], "isolates")

        # Get any isolates that have the isolate id to be removed (only one should match!).
        isolates_to_remove = [isolate for isolate in isolates if isolate["isolate_id"] == data["isolate_id"]]

        # Make sure that one and only one isolate matches the isolate id that is being removed.
        assert len(isolates_to_remove) == 1

        # The isolate the is to be removed.
        isolate_to_remove = isolates_to_remove[0]

        # Remove the isolate from the virus' isolate list.
        isolates.remove(isolate_to_remove)

        # Set the first isolate as default is the removed isolate was the default.
        if isolate_to_remove["default"]:
            for i, isolate in enumerate(isolates):
                isolate["default"] = (i == 0)

        old = yield self.join(data["_id"])

        yield self.update(data["_id"], {
            "$set": {
                "isolates": isolates,
                "modified": True
            },
        })

        # Remove any sequences associated with the removed isolate.
        yield self.sequences_collection.remove({"isolate_id": data["isolate_id"]})
        new = yield self.join(data["_id"])

        yield self.collections["history"].add(
            "update",
            "remove_isolate",
            old,
            new,
            transaction.connection.user["_id"]
        )

        return True, {
            "isolate_id": data["isolate_id"],
            "virus_id": data["_id"]
        }

    @virtool.gen.exposed_method(["modify_virus"])
    def set_default_isolate(self, transaction):
        """
        Sets the isolate with the passed isolate id as the default isolate. Removes the default flag from the previous
        default isolate.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

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

    @virtool.gen.exposed_method(["modify_virus"])
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
        isolate_ids = yield extract_isolate_ids(virus)

        # Get the sequences associated with the virus isolates.
        sequences = yield self.sequences_collection.find({"isolate_id": {"$in": isolate_ids}}).to_list(None)

        # Verify the virus, returning any verification errors.
        verification_errors = yield check_virus(virus, sequences)

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

    @virtool.gen.exposed_method([])
    def fetch_ncbi(self, transaction):
        """
        Takes an NCBI accession number and gets the associated Genbank entry from NCBI. Converts the Genbank data into
        a Virtool-style sequence document and returns it to the client.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a sequence dict created from the Genbank data.
        :rtype: tuple

        """
        seq_dict = yield get_from_ncbi(transaction.data["accession"])

        if seq_dict:
            return True, seq_dict

        return False, None

    @virtool.gen.exposed_method(["modify_virus"])
    def add_sequence(self, transaction):
        """
        Adds a new sequence to a virus isolate with given virus and isolate ids.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a the update response.
        :rtype: tuple

        """
        old_virus, sequence = yield self.prepare_sequences(
            transaction.data["_id"],
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

    @virtool.gen.exposed_method(["modify_virus"])
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

    @virtool.gen.exposed_method(["modify_virus"])
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
            "$inc": {"sequence_count": -1},
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

    @virtool.gen.exposed_method(["modify_virus"])
    def export(self):
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

    @virtool.gen.exposed_method(["modify_virus"])
    def import_data(self, transaction):
        """
        Imports virus data from an uploaded json.gz file.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a the number of viruses and isolates added.
        :rtype: tuple

        """
        # The file id to import the data from.
        file_id = transaction.data["file_id"]

        # Load a list of joined virus from a the gzip-compressed JSON.
        with gzip.open(os.path.join(self.settings.get("data_path"), "upload", file_id), "rt") as input_file:
            viruses_to_import = json.load(input_file)

        used_virus_fields = yield self.get_used_virus_fields()
        used_isolate_ids = yield self.get_used_isolate_ids()

        # Warnings that will be sent to the client if the method fails.
        warnings = {
            "name": list(),
            "abbreviation": list(),
            "sequences": list()
        }

        # A response to send the client if the method succeeds.
        response = {
            "viruses": len(viruses_to_import),
            "isolates": 0
        }

        # A list of sequence documents that should be added to the sequences collection.
        sequences = list()

        viruses_to_import = [virus for virus in viruses_to_import if isinstance(virus, dict)]

        for index, virus in enumerate(viruses_to_import):
            # Go through each isolate in the virus.
            for isolate in virus["isolates"]:
                # Increment the counter for the number of added isolates by one.
                response["isolates"] += 1

                # In the viruses collection there is no sequences field, but there is a sequence_count field. Set a
                # sequence_count field and pop out the sequences field and join it to the list of sequences that will be
                # added to the sequences collection.
                isolate["sequence_count"] = len(isolate["sequences"])
                sequences += isolate.pop("sequences")

                # Check if the isolate id is already used in the viruses collection.
                if isolate["isolate_id"] in used_isolate_ids:
                    # Generate a new isolate id if the imported isolate id is already in the viruses collection.
                    isolate["isolate_id"] = yield self.generate_isolate_id(used_isolate_ids)

                    # Append the generated isolate to a list of used isolate ids so that is isn't reused during the
                    # import process.
                    used_isolate_ids.append(isolate["isolate_id"])

            # Generate a new virus id if the imported one already exists in the collection.
            if virus["_id"] in used_virus_fields["_id"]:
                virus["_id"] = yield self.generate_virus_id(used_virus_fields)
                # Add the generated virus id to a list of used ones so that it isn't reused during the import process.
                used_virus_fields["_id"].append(virus["_id"])

            # Check that the name and abbreviation fields in the virus don't already exist in the collection.
            for key in ["name", "abbreviation"]:
                if virus[key] != "" and virus[key] in used_virus_fields[key]:
                    warnings[key].append(virus[key])

            used_virus_fields["_id"].append(virus["_id"])

        # Get the ids of all sequences in the sequence collection.
        used_sequence_ids = list()

        cursor = self.sequences_collection.find({}, {"_id": True})

        while (yield cursor.fetch_next):
            used_sequence_ids.append(cursor.next_object()["_id"])

        # Append to warnings any sequence ids to be imported that already exist in the sequences collection.
        for sequence in sequences:
            if sequence["_id"] in used_sequence_ids:
                warnings["sequences"].append(sequence["_id"])

        # If any warnings have been generated, fail the method and send the warnings dict to the client.
        if sum([len(warnings[key]) for key in ["name", "abbreviation", "sequences"]]) < 0:
            return False, warnings

        # Insert virus and sequence documents.
        for sequence in sequences:
            yield self.sequences_collection.insert(sequence)

        for virus in viruses_to_import:
            # Update documents with this information now instead of last virus loop in case warnings were raised. Saves
            # needless processing.
            virus.update({
                "_version": 0,
                "modified": False,
                "last_indexed_version": None
            })

            yield self.insert_virus(virus, transaction.connection.user["_id"])

        return True, response

    @virtool.gen.coroutine
    def join(self, virus_id, virus=None):
        """
        Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
        database will not be queried for the virus based on its id.

        :param virus_id: the id of the virus to join.
        :type virus_id: str

        :param virus: use this virus document as a basis for the join instead finding it using the virus id.
        :type virus: dict

        :return: the joined virus document
        :rtype: dict

        """
        # Get the virus entry if a virus parameter was not passed.
        if not virus:
            virus = yield self.find_one({"_id": virus_id})

        if virus is None:
            return None

        # Extract the isolate_ids associated with the virus.
        isolate_ids = yield extract_isolate_ids(virus)

        # Get the sequence entries associated with the isolate ids.
        sequences = yield self.sequences_collection.find({"isolate_id": {"$in": isolate_ids}}).to_list(None)

        # Merge the sequence entries into the virus entry.
        virus = merge_virus(virus, sequences)

        return virus

    @virtool.gen.coroutine
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

    @virtool.gen.coroutine
    def insert_virus(self, virus, username):
        """
        Inserts the passed virus dict into the collection as a new document, attributing it to the passed username.

        :param virus: the virus dict to insert.
        :param username: the name of the user that created the virus.
        :return: the response from the Mongo insert method

        """
        response = yield self.insert(virus)

        # Join the virus entry in order to insert the first history record for the virus.
        joined = yield self.join(virus["_id"])

        yield self.collections["history"].add(
            "insert",
            "add",
            None,  # there is no old document
            joined,
            username
        )

        return response

    @virtool.gen.coroutine
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

    @virtool.gen.coroutine
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

    @virtool.gen.coroutine
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
                    isolate["sequence_count"] += 1
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

    @virtool.gen.coroutine
    def generate_virus_id(self, used_virus_fields=None):
        """
        Generate a unique virus id.

        :param used_virus_fields: a dict of lists containing used field values. Will be calculated if None is passed.
        :return: a unique virus id.

        """
        excluded = None

        if used_virus_fields:
            excluded = used_virus_fields["_id"]

        virus_id = yield self.get_new_id(excluded)

        return virus_id

    @virtool.gen.coroutine
    def get_used_virus_fields(self):
        """
        Get all used ids, names, and abbreviations in the collection.

        :return: a dict of lists containing in-use values, keyed be field names.

        """
        cursor = self.find({}, {
            "_id": True,
            "name": True,
            "abbreviation": True
        })

        # Prepare the result dict.
        used = {field: list() for field in ["_id", "name", "abbreviation"]}

        while (yield cursor.fetch_next):
            virus = cursor.next_object()

            for field in used:
                used[field].append(virus[field])

        return used

    @virtool.gen.coroutine
    def generate_isolate_id(self, used_isolate_ids=None):
        """
        Generates a unique isolate id.

        :param used_isolate_ids: a list of all extant isolate ids; will be calculated from scratch is None is provided.
        :return: a unique isolate id.
        """

        if not used_isolate_ids:
            used_isolate_ids = yield self.get_used_isolate_ids()

        return virtool.utils.random_alphanumeric(8, excluded=used_isolate_ids)

    @virtool.gen.coroutine
    def get_used_isolate_ids(self):
        """
        Get every isolate id that exists in the collection.

        :return: a list of all extant isolate ids.

        """
        # Flatten the isolate list and generate a list of single key dicts: {"_id": <isolate id>}.
        aggregation_cursor = self.aggregate([
            {"$unwind": "$isolates"},
            {"$group": {"_id": "$isolates.isolate_id"}}
        ])

        # Transform used_isolate_ids to a list of isolate_id strings.
        used_isolate_ids = list()

        while (yield aggregation_cursor.fetch_next):
            isolate = aggregation_cursor.next_object()
            used_isolate_ids.append(isolate["_id"])

        return used_isolate_ids


@virtool.gen.synchronous
def check_virus(virus, sequences):
    """
    Checks that the passed virus and sequences constitute valid Virtool records and can be included in a virus
    index. Error fields are:

    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.

    :param virus: the virus document.
    :param sequences: a list of sequence documents associated with the virus.
    :return: return any errors or False if there are no errors.

    """
    errors = {
        "empty_virus": len(virus["isolates"]) == 0,  #
        "empty_isolate": list(),
        "empty_sequence": list(),
        "isolate_inconsistency": False
    }

    isolate_sequence_counts = list()

    # Append the isolate_ids of any isolates without sequences to empty_isolate. Append the isolate_id and sequence
    # id of any sequences that have an empty sequence.
    for isolate in virus["isolates"]:
        isolate_sequences = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]
        isolate_sequence_count = len(isolate_sequences)

        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["isolate_id"])

        isolate_sequence_counts.append(isolate_sequence_count)

        errors["empty_sequence"] += filter(lambda sequence: len(sequence["sequence"]) == 0, isolate_sequences)

    # Give an isolate_inconsistency error the number of sequences is not the same for every isolate. Only give the
    # error if the virus is not also emtpy (empty_virus error).
    errors["isolate_inconsistency"] = (
        len(set(isolate_sequence_counts)) != 1 and not
        (errors["empty_virus"] or errors["empty_isolate"])
    )

    # If there is an error in the virus, return the errors object. Otherwise return False.
    has_errors = False

    for key, value in errors.items():
        if value:
            has_errors = True
        else:
            errors[key] = False

    if has_errors:
        return errors

    return False


def merge_virus(virus, sequences):
    """
    Merge the given sequences in the given virus document. The virus document will lose its *sequence_count* field and
    gain a *sequences* field containing its associated sequences.

    :param virus: a virus document.
    :param sequences: a list of sequence documents associated with the virus.
    :return: the merged virus.

    """
    for isolate in virus["isolates"]:
        isolate.pop("sequence_count")
        isolate["sequences"] = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]

    return virus


def get_default_isolate(virus, processor=None):
    """
    Returns the default isolate dict for the given virus document.

    :param virus: a virus document.
    :type virus: dict
    :param processor: a function to process the default isolate into a desired format.
    :type: func
    :return: the default isolate dict.
    :rtype: dict

    """
    # Get the virus isolates with the default flag set to True. This list should only contain one item.
    default_isolates = [isolate for isolate in virus["isolates"] if virus["default"] == True]

    # Check that there is only one item.
    assert len(default_isolates) == 1

    default_isolate = default_isolates[0]

    if processor:
        default_isolate = processor(default_isolate)

    return default_isolate


@virtool.gen.synchronous
def extract_isolate_ids(virus):
    """
    Get the isolate ids from a virus document.

    :param virus: a virus document.
    :return: a list of isolate ids.

    """
    return [isolate["isolate_id"] for isolate in virus["isolates"]]


def extract_sequence_ids(joined_virus):
    """
    Get the ids of all sequences in a joined virus.

    :param joined_virus: a joined virus comprising the virus document and its associated sequences.
    :return: a list of sequence ids.

    """
    sequence_ids = list()

    for isolate in joined_virus["isolates"]:
        for sequence in isolate["sequences"]:
            sequence_ids.append(sequence["_id"])

    return sequence_ids


def patch_virus(virus=None, history=None):
    """
    Patch a given virus by reverting all the changes described by a list of history documents.

    :param virus: the current virus document.
    :param history: a list of history documents associated with the virus--can be empty.

    :return: tuple containing the passed virus, the patched virus, a list of history ids that were reverted to arrive \
    at the patched virus.

    """
    # If no virus dict was passed, make it an empty dict. In this case, the virus was probably removed and the complete
    # entry is stored in the last history document associated with the virus.
    virus = virus or dict()

    # A list of history documents associated with the virus.
    history = history or list()

    # A list of history_ids reverted to produce the patched entry.
    reverted_history_ids = list()

    # Sort the changes be descending entry version.
    history = sorted(history, lambda x: x["timestamp"], reverse=True)

    # Clone the virus dict so the original dict can still be returned at the end of the end of the function.
    patched = dict(virus)

    for history_doc in history:

        reverted_history_ids.append(history_doc["_id"])

        # The initial addition of the virus is being reverted. Return "remove" instead of a patched virus.
        if history_doc["method_name"] == "add":
            patched = "remove"

        # The removal of the virus is being reverted. A history document describing a removal stores the entire joined
        # virus in the *changes* field. Use this as the basis for patching the virus.
        elif history_doc["method_name"] == "remove":
            patched = history_doc["changes"]
            break

        # Any other method_name is an update operation. Get the diff from the history document *changes* field and use
        # it to revert the joined virus using dictdiffer.patch.
        else:
            diff = dictdiffer.swap(history_doc["changes"])
            patched = dictdiffer.patch(diff, patched)

    return virus, patched, reverted_history_ids


def get_bowtie2_index_names(index_path):
    """
    | Get the headers of all the FASTA sequences used to build the Bowtie2 index in *index_path*.
    | *Requires Bowtie2 in path.*

    :param index_path: the patch to the Bowtie2 index.
    :return: list of FASTA headers.
    """
    try:
        inspect = subprocess.check_output(["bowtie2-inspect", "-n", index_path], stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None

    inspect_list = str(inspect, "utf-8").split("\n")
    inspect_list.remove("")

    return inspect_list


@virtool.gen.synchronous
def get_from_ncbi(accession):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-format sequence
    document.

    :param accession: the Genbank accession number.
    :return: a sequence document containing relevant Genbank data for the accession.

    """
    Entrez.tool = "Virtool"
    Entrez.email = "ian.boyes@inspection.gc.ca"

    term = accession + '[accn]'

    gi_handle = Entrez.esearch(db="nucleotide", term=term)
    gi_record = Entrez.read(gi_handle)

    gi_list = gi_record["IdList"]

    if len(gi_list) == 1:
        gb_handle = Entrez.efetch(db="nuccore", id=gi_list[0], rettype="gb", retmode="text")
        gb_record = list(SeqIO.parse(gb_handle, "gb"))

        seq_record = gb_record[0]

        seq_dict = {
            "accession": seq_record.name,
            "sequence": str(seq_record.seq),
            "definition": seq_record.description,
            "host": ""
        }

        for feature in seq_record.features:
            for key, value in feature.qualifiers.items():
                if key == "host":
                    seq_dict["host"] = value[0]

        return seq_dict
    else:
        return None


def check_collection(db_name, data_path, host="localhost", port=27017):
    """
    Checks the entire collection and any for problems.

    :param db_name:
    :param data_path:
    :param host:
    :param port:
    :return:

    """
    db = pymongo.MongoClient(host, port)[db_name]

    indexes_path = os.path.join(data_path, "reference/viruses/")

    response = {
        "missing_index": False,
        "mismatched_index": False,
        "missing_history": list(),
        "missing_recent_history": list(),
        "orphaned_analyses": os.listdir(indexes_path)
    }

    ref_names = None

    # Get the entry describing the most recently built (active) index from the DB.
    try:
        active_index = db.indexes.find({"ready": True}).sort("index_version", -1)[0]
    except IndexError:
        active_index = None

    # Check that there is an active index.
    if active_index:
        active_index_path = os.path.join(indexes_path, active_index["_id"])

        # Set missing index to True if we can find the directory for the active index on disk.
        response["missing_index"] = not os.path.exists(active_index_path)

        # This key-value is initially a list of all indexes on disk. Remove the index_id of the active index.
        try:
            response["orphaned_analyses"].remove(active_index["_id"])
        except ValueError:
            pass

        # Get the FASTA headers of all the sequences used to build the reference.
        ref_names = get_bowtie2_index_names(os.path.join(active_index_path, "reference"))

    sequence_ids = list()

    for virus in db.viruses.find({}):
        default_isolate = get_default_isolate(virus)

        sequences = list(db.sequences.find({"isolate_id": default_isolate["isolate_id"]}))

        patched_and_joined = merge_virus(virus, sequences)

        if virus["_version"] > 0:
            # Get all history entries associated with the virus entry.
            history = list(db.history.find({"entry_id": virus["_id"]}).sort("entry_version", -1))

            # If this tests true, the virus has a greater version number than can be accounted for by the history. This
            # is not a fatal problem.
            if virus["_version"] > len(history):
                response["missing_history"].append(virus["_id"])

            # If the virus entry version is higher than the last_indexed_version, check that the unbuilt changes are
            # stored in history. Also patch the virus back to its last_index_version state and store in patched_viruses.
            if virus["last_indexed_version"] != virus["_version"]:
                # The number of virus entry versions between the current version and the last_indexed_version.
                required_unbuilt_change_count = int(virus["_version"] - virus["last_indexed_version"])

                # Count the number of history entries containing unbuilt changes for this virus.
                recent_history = virtool.utils.where(history, lambda x: x["index_version"] == x["unbuilt"])

                # The two previously assigned variables must be equal. Otherwise the virus_id will be added to the
                # missing_recent_history list in the response dict returned by this function.
                if required_unbuilt_change_count != len(recent_history):
                    response["missing_recent_history"].append(virus["_id"])

                _, patched_and_joined, _ = virus(patched_and_joined, recent_history)

        sequence_ids += extract_sequence_ids(patched_and_joined)

    sequence_id_set = set(sequence_ids)

    response["duplicate_sequence_ids"] = len(sequence_id_set) < len(sequence_ids)

    if ref_names:
        response["mismatched_index"] = sequence_id_set != set(ref_names)

    response["failed"] = response["missing_index"] or response["mismatched_index"] or response["missing_recent_history"]

    return response
