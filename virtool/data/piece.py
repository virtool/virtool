from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class DataLayerPiece:
    data: "DataLayer"

    def bind_layer(self, layer: "DataLayer"):
        self.data = layer