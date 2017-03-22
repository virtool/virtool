import virtool.database


class Collection(virtool.database.Collection):

    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("status", dispatch, collections, settings, add_periodic_callback)

        self.sync_projector = None
