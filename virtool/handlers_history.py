def revert(req):

    document, patched, history_to_delete = yield self.get_versioned_document(
        data["entry_id"],
        data["entry_version"]
    )

    isolate_ids = virtool.virusutils.extract_isolate_ids(document or patched)

    # Remove the old sequences from the collection.
    yield self.sequences_collection.remove({"isolate_id": {"$in": isolate_ids}})

    if patched != "remove":
        # Add the reverted sequences to the collection.
        for isolate in patched["isolates"]:
            for sequence in isolate["sequences"]:
                yield self.sequences_collection.insert(sequence)

        if document:
            yield self.collections["viruses"].update(
                document["_id"],
                {"$set": patched},
                increment_version=False
            )
        else:
            yield self.collections["viruses"].db.insert(patched)
    else:
        yield self.collections["viruses"].remove(document["_id"])

    yield self.remove(history_to_delete)

    return True, history_to_delete