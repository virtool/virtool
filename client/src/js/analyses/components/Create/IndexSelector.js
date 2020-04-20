import React from "react";
import { IndexSelectorList } from "./IndexSelectorList";

export const IndexSelector = ({ indexes, onSelect, selected, error }) => (
    <React.Fragment>
        <label>References</label>
        <IndexSelectorList error={error} indexes={indexes} selected={selected} onSelect={onSelect} />
    </React.Fragment>
);
