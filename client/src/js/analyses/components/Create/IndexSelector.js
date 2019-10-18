import React from "react";
import { IndexSelectorList } from "./IndexSelectorList";

export const IndexSelector = ({ indexes, onSelect, selected, error }) => {
    return (
        <div style={{ marginBottom: "16px" }}>
            <label className="control-label">References</label>
            <IndexSelectorList error={error} indexes={indexes} selected={selected} onSelect={onSelect} />
        </div>
    );
};
