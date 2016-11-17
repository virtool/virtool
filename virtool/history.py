import dictdiffer
import motor

import virtool.utils
import virtool.gen
import virtool.database
import virtool.viruses


class Collection(virtool.database.SyncingCollection):

    def __init__(self, dispatcher):
        super().__init__("history", dispatcher)

        self.sync_projector.update({key: True for key in [
            "operation",
            "method_name",
            "changes",
            "timestamp",
            "entry_id",
            "entry_version",
            "username",
            "annotation",
            "index",
            "index_version"
        ]})

        self.sequences_collection = motor.MotorClient()[self.settings.get("db_name")]["sequences"]

    @virtool.gen.coroutine
    def sync_processor(self, documents):
        documents = virtool.database.coerce_list(documents)

        for document in documents:
            if document["operation"] in ["insert", "remove"]:
                document["virus"] = document["changes"]["name"]
            else:
                _, patched, _ = yield self.get_versioned_document(document["entry_id"], document["entry_version"])
                document["virus"] = patched["name"]

        return documents

    @virtool.gen.exposed_method([])
    def sync(self, transaction):
        """
        Syncs documents between the server and client. This exposed method will be requested by the client soon after
        its connection is authorized. The client supplies a dictionary of document ids and their version
        numbers. This manifest is used to calculate a list of updates and removals required to bring the client's local
        collection in sync with the one on the server. The calculation is performed by :meth:`.Collection.prepare_sync`.

        The passed ``transaction`` is then updated with the number of update and remove operation that will be
        dispatched to the client. This allows the client to display the progress of the sync operation as it receives
        updates and removals.

        :param transaction: the transaction generated from the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating success and the total number of operations performed.
        :rtype: tuple

        """
        manifest = transaction.data

        if manifest:
            database_ids = yield self.db.distinct("_id")
            database_ids = set(database_ids)

            manifest_ids = set(manifest.keys())

            to_update = list(database_ids - manifest_ids)

            updates = list()

            if len(to_update) > 0:
                updates = yield self.find({"_id": {
                    "$in": to_update
                }}, self.sync_projector).to_list(None)

                updates = yield self.sync_processor(updates)

            removes = list(manifest_ids - database_ids)
        else:
            updates = yield self.find({}, self.sync_projector).to_list(None)
            updates = yield self.sync_processor(updates)
            removes = list()

        expected_operation_count = len(updates) + len(removes)

        transaction.update(expected_operation_count)

        for i in range(0, len(updates), 10):
            yield self.dispatch("update", updates[i: i + 10], connections=[transaction.connection], sync=True)

        # All remaining documents should be deleted by the client since they no longer exist on the server.
        for i in range(0, len(removes), 10):
            yield self.dispatch("remove", removes[i: i + 10], connections=[transaction.connection], sync=True)

        return True, None

    @virtool.gen.coroutine
    def add(self, operation, method_name, old, new, username):
        # Construct and _id for the change entry. It is composed of the _id of the changed entry and the new version
        # number of the entry separated by a dot (eg. a7sydi.3)
        try:
            document_id = old["_id"]
        except TypeError:
            document_id = new["_id"]

        try:
            document_version = new["_version"]
        except TypeError:
            document_version = "removed"

        history_document = {
            "_id":  str(document_id) + "." + (str(document_version)),
            "_version": 0,
            "operation": operation,
            "method_name": method_name,
            "timestamp": virtool.utils.timestamp(),
            "entry_id": document_id,
            "entry_version": document_version,
            "username": username,
            "annotation": None,
            "index": "unbuilt",
            "index_version": "unbuilt"
        }

        if operation in ["update", "remove", "insert"]:
            if operation == "update":
                history_document["changes"] = list(dictdiffer.diff(old, new))
            elif operation == "remove":
                history_document["changes"] = old
            else:
                history_document["changes"] = new
        else:
            raise ValueError("Passed operation is not one of 'update', 'remove', 'insert'")

        if method_name == "set_default_isolate":
            history_document["annotation"] = yield self.get_default_isolate(new)

        if method_name == "upsert_isolate":
            history_document["annotation"] = yield self.get_upserted_isolate(old, history_document["changes"])

        if method_name == "remove_sequence":
            subject_isolate = yield self.get_isolate_of_removed_sequence(old, history_document["changes"])
            assert subject_isolate is not None
            history_document["annotation"] = subject_isolate

        if method_name == "add_sequence":
            subject_isolate = yield self.get_isolate_of_added_sequence(new, history_document["changes"])
            history_document["annotation"] = subject_isolate

        if method_name == "update_sequence":
            subject_isolate = yield self.get_info_for_updated_sequence(new, history_document["changes"])
            history_document["annotation"] = subject_isolate

        yield self.insert(history_document)

    @virtool.gen.synchronous
    def get_default_isolate(self, document):
        for isolate in document["isolates"]:
            if isolate["default"]:
                return strip_isolate(isolate)

        raise ValueError("Could not find default isolate in virus document")

    @virtool.gen.synchronous
    def get_upserted_isolate(self, document, changes):
        for change in changes:
            if change[0] == "change" and change[1][0] == "isolates":
                return document["isolates"][change[1][1]]

        return None

    @virtool.gen.synchronous
    def get_info_for_updated_sequence(self, document, changes):
        for change in changes:
            if change[0] == "change" and change[1][2] == "sequences":
                isolate = document["isolates"][change[1][1]]
                sequence_index = change[1][3]
                sequence = {key: isolate["sequences"][sequence_index][key] for key in ["_id", "definition"]}

                isolate = strip_isolate(isolate)
                isolate.update(sequence)

                return isolate

        raise ValueError("Could not find isolate of updated sequence")

    @virtool.gen.synchronous
    def get_isolate_of_added_sequence(self, document, changes):
        for change in changes:
            if change[0] == "add" and change[1][0] == "isolates":
                isolate_index = change[1][1]
                return strip_isolate(document["isolates"][isolate_index])

        raise ValueError("Could not find isolate of added sequence")

    @virtool.gen.synchronous
    def get_isolate_of_removed_sequence(self, document, changes):
        for change in changes:
            if change[0] == "remove":
                isolate_index = change[1][1]
                return strip_isolate(document["isolates"][isolate_index])

        raise ValueError("Could not find isolate of removed sequence")

    @virtool.gen.exposed_method(["modify_virus"])
    def revert(self, transaction):
        data = transaction.data

        document, patched, history_to_delete = yield self.get_versioned_document(
            data["entry_id"],
            data["entry_version"]
        )

        isolate_ids = yield virtool.viruses.extract_isolate_ids(document or patched)

        # Remove the old sequences from the collection.
        yield self.sequences_collection.remove({"isolate_id": {"$in": isolate_ids}})

        if patched != "remove":
            # Add the reverted sequences to the collection.
            for isolate in patched["isolates"]:
                for sequence in isolate["sequences"]:
                    yield self.sequences_collection.insert(sequence)

            for isolate in patched["isolates"]:
                isolate["sequence_count"] = len(isolate.pop("sequences"))

            if document:
                yield self.dispatcher.collections["viruses"].update(
                    document["_id"],
                    {"$set": patched},
                    increment_version=False
                )
            else:
                yield self.dispatcher.collections["viruses"].insert(patched)
        else:
            yield self.dispatcher.collections["viruses"].remove(document["_id"])

        yield self.remove(history_to_delete)

        return True, history_to_delete

    @virtool.gen.coroutine
    def get_versioned_document(self, virus_id, virus_version):
        current = yield self.dispatcher.collections["viruses"].join(virus_id)

        versioned = yield self.patch_virus_to_version(current or {"_id": virus_id}, virus_version)

        return current, versioned[1], versioned[2]

    @virtool.gen.coroutine
    def patch_virus_to_version(self, joined_virus, version):
        virus_history = yield self.find({"entry_id": joined_virus["_id"]}).to_list(None)

        current = joined_virus or dict()

        # A list of history_ids reverted to produce the patched entry.
        reverted_history_ids = list()

        # Sort the changes be descending entry version.
        virus_history = sorted(virus_history, key=lambda x: x["timestamp"], reverse=True)

        patched = dict(current)

        for history_document in virus_history:
            if history_document["entry_version"] == "removed" or history_document["entry_version"] >= version:
                reverted_history_ids.append(history_document["_id"])

                if history_document["method_name"] == "add":
                    patched = "remove"

                elif history_document["method_name"] == "remove":
                    patched = history_document["changes"]
                    break

                else:
                    diff = dictdiffer.swap(history_document["changes"])
                    patched = yield patch(diff, patched)
            else:
                break

        return current, patched, reverted_history_ids

    @virtool.gen.coroutine
    def reversion_update(self, _id, reverted):
        yield self.update(_id, reverted, reversion=True)

    @virtool.gen.coroutine
    def set_index_as_unbuilt(self, data):
        yield self.update({"index": data["index_id"]}, {
            "$set": {
                "index": "unbuilt",
                "index_version": "unbuilt"
            }
        })


@virtool.gen.synchronous
def patch(diff, subject):
    return dictdiffer.patch(diff, subject)


def strip_isolate(isolate):
    return {key: isolate[key] for key in ["source_type", "source_name", "isolate_id"]}
