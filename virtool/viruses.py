import os
import re
import json
import gzip
import logging
import pymongo
import pymongo.errors
import pymongo.collection

import virtool.gen
import virtool.utils
import virtool.database

from virtool import virusutils


logger = logging.getLogger(__name__)


class Collection(virtool.database.Collection):

    """
    Viruses collection

    """
    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("viruses", dispatch, collections, settings, add_periodic_callback)

        # Set what is sent to the client when syncing.
        self.sync_projector += ["name", "modified", "abbreviation"]

        # Contains documents describing viral sequences associated with viruses in the viruses collection. Changes to
        # sequence documents only occur by calling methods in this Collection object.
        self.sequences_collection = settings.get_db_client()["sequences"]

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
        virus = dict(transaction.data, username=transaction.connection.user["_id"])

        try:
            response = yield self._add(virus)
        except VirusNameExistsError:
            return False, dict(message="Virus name already exists")
        except VirusAbbreviationExistsError:
            return False, dict(message="Virus abbreviation already exists")

        return True, response

    @virtool.gen.coroutine
    def _add(self, virus, imported=False):
        name_count, abbreviation_count = yield self.check_name_and_abbreviation(virus["name"], virus["abbreviation"])

        # Transaction fails if the name or abbreviation are in use.
        if abbreviation_count:
            raise VirusAbbreviationExistsError

        if name_count:
            raise VirusNameExistsError

        virus["_id"] = yield self.get_new_id()

        virus["imported"] = imported

        yield self.insert(virus)

        return virus["_id"]

    @virtool.gen.coroutine
    def check_name_and_abbreviation(self, name, abbreviation=None):
        abbreviation_count = 0

        if abbreviation:
            abbreviation_count = yield self.find({"abbreviation": abbreviation}).count()

        name_count = yield self.find({"name": re.compile(name, re.IGNORECASE)}).count()

        return name_count, abbreviation_count

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
        username = transaction.connection.user["_id"]

        try:
            response = yield self._remove_virus(virus_id, username)

        except TypeError as err:
            if "_id must be" in str(err):
                logger.warning("User {} attempted to remove more than one virus in a single call".format(username))
                return False, dict(message="Attempted to remove more than one virus in a single call")
            raise

        except ValueError as err:
            if "virus associated with" in str(err):
                logger.warning("User {} attempted to remove non-existent virus".format(username))
                return False, dict(message="Attempted to remove non-existent virus")
            raise

        return True, response

    @virtool.gen.coroutine
    def _remove_virus(self, virus_id, username, imported=False):
        """
        Remove a virus document by its id. Also removes any associated sequence documents from the sequences
        collection and adds a record of the removal to the history collection.

        :param virus_id: the _id of the virus to remove.
        :type virus_id: str

        :param username: the name of the user responsible for the removal.
        :type username: str

        :return: a tuple containing a bool indicating success and data to pass back to the client.
        :rtype: tuple

        """
        # Can only remove one virus per request. Fail if a list of virus ids is passed.
        if not isinstance(virus_id, str):
            raise TypeError("Virus _id must be an instance of str")

        # Join the virus.
        virus = yield self.join(virus_id)

        if not virus:
            raise ValueError("No virus associated with _id {}".format(virus_id))

        # Get all the isolate ids from the
        isolate_ids = yield virusutils.extract_isolate_ids(virus)

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
            username,
            imported=imported
        )

        return response

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
            isolate_id = yield self.get_new_isolate_id()

            # Set the isolate as the default isolate if it is the first one.
            new_isolate.update({
                "default": len(isolates) == 0,
                "isolate_id": isolate_id,
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
        Remove an isolate from a virus document given a virus id and isolate id.

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
            }
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
        isolate_ids = yield virusutils.extract_isolate_ids(virus)

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
        seq_dict = yield virusutils.get_from_ncbi(transaction.data["accession"])

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

    @virtool.gen.exposed_method(["modify_virus"])
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
        used_names = yield self.db.distinct("name")
        used_names = {name.lower() for name in used_names}

        empty_collection = len(used_names) == 0

        conflicts = yield self.find_import_conflicts(viruses, replace)

        if conflicts:
            return False, dict(message="Conflicting sequence ids", conflicts=conflicts)

        used_isolate_ids = yield self.db.distinct("isolates.isolate_id")
        used_isolate_ids = set(used_isolate_ids)

        base_virus_document = {
            "_version": 0,
            "last_index_version": 0,
            "modified": False,
            "username": transaction.connection.user["_id"],
            "imported": True
        }

        for i, virus in enumerate(viruses):
            # Calculate the overall progress (how many viruses in the import document have been processed?)
            progress = round((i + 1) / virus_count, 3)

            print(progress)

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

                yield self.insert(to_insert)

                for sequence_document in sequences:
                    yield self.sequences_collection.insert(sequence_document)

                counter["added"] += 1

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

            if virus_with_abbreviation and virus_with_abbreviation["name"].lower() != lower_name:
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
                existing_virus = yield self.find_one({"name": re.compile(virus["name"], re.IGNORECASE)})

                isolate_ids = yield virtool.virusutils.extract_isolate_ids(existing_virus)

                # Remove the existing virus, including its sequences.
                yield self._remove_virus(existing_virus["_id"], transaction.connection.user["_id"])

                # Remove all sequence documents associated with the existing virus.
                yield self.sequences_collection.remove({"_id": {
                    "$in": isolate_ids
                }})

                counter["replaced"] += 1

            to_insert.update({key: virus_document[key] for key in ["abbreviation", "name", "isolates"]})

            # Add the new virus.
            yield self.insert(to_insert)

            for sequence_document in sequences:
                yield self.sequences_collection.insert(sequence_document)

            if not virus_exists:
                counter["added"] += 1

        counter["progress"] = 1
        transaction.update(counter)

        return True, counter

    @virtool.gen.coroutine
    def find_import_conflicts(self, viruses, replace):
        used_names = yield self.db.distinct("name")
        used_names = [name.lower() for name in used_names]

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

            # print(virus["name"], virus_exists, sequence_ids_to_import, len(already_existing_sequences))

            if virus_exists:
                # Continue to the next virus if this one cannot be applied to the database.
                if not replace:
                    continue

                # The full document of the existing virus.
                existing_virus = yield self.find_one(
                    {"name": re.compile(virus["name"], re.IGNORECASE)},
                    ["_id", "isolates"]
                )

                # The isolate ids in the existing virus document.
                existing_isolate_ids = yield virtool.virusutils.extract_isolate_ids(existing_virus)

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

    @virtool.gen.coroutine
    def join(self, virus_id, virus_document=None):
        """
        Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
        database will not be queried for the virus based on its id.

        :param virus_id: the id of the virus to join.
        :type virus_id: str

        :param virus_document: use this virus document as a basis for the join instead finding it using the virus id.
        :type virus_document: dict

        :return: the joined virus document
        :rtype: dict

        """
        # Get the virus entry if a virus parameter was not passed.
        if not virus_document:
            virus_document = yield self.find_one({"_id": virus_id})

        if virus_document is None:
            return None

        # Extract the isolate_ids associated with the virus.
        isolate_ids = yield virusutils.extract_isolate_ids(virus_document)

        # Get the sequence entries associated with the isolate ids.
        sequences = yield self.sequences_collection.find({"isolate_id": {"$in": isolate_ids}}).to_list(None)

        # Merge the sequence entries into the virus entry.
        virus = virusutils.merge_virus(virus_document, sequences)

        return virus

    @virtool.gen.coroutine
    def insert(self, virus, connections=None):
        """
        Inserts the passed virus dict into the collection as a new document, attributing it to the passed username.

        :param virus: the virus dict to insert
        :type virus: dict

        :param connections: connection objects to dispatch the update to
        :type connections: list

        :return: the response from the Mongo insert method
        :rtype: object

        """
        virus.update({
            "modified": True,
            "last_indexed_version": None
        })

        if "imported" not in virus:
            virus["imported"] = False

        if "isolates" not in virus:
            virus["isolates"] = list()

        response = yield super().insert(virus, connections)

        # Join the virus entry in order to insert the first history record for the virus.
        joined = yield self.join(virus["_id"])

        yield self.collections["history"].add(
            "insert",
            "add",
            None,  # there is no old document
            joined,
            virus["username"],
            imported=virus["imported"]
        )

        return response

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
    def get_new_isolate_id(self, used_isolate_ids=None):
        """
        Generates a unique isolate id.

        :param used_isolate_ids: a list of all extant isolate ids; will be calculated from scratch is None is provided.
        :return: a unique isolate id.
        """

        if not used_isolate_ids:
            used_isolate_ids = yield self.db.distinct("isolates.isolate_id")

        return virtool.utils.random_alphanumeric(8, excluded=used_isolate_ids)

    @virtool.gen.exposed_method(["modify_virus"])
    def authorize_upload(self, transaction):
        target = yield self.collections["files"].register(
            name=transaction.data["name"],
            size=transaction.data["size"],
            file_type="viruses"
        )

        return True, dict(target=target)





class VirusNameExistsError(Exception):
    pass


class VirusAbbreviationExistsError(Exception):
    pass
