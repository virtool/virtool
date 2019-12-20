import React from "react";
import { InputError } from "../../../base";

export const SegmentCol = ({ value, onChange, error, segmentNames }) => (
    <div>
        <InputError type="select" label="Segment" name="segment" value={value} onChange={onChange} error={error}>
            {segmentNames}
        </InputError>
    </div>
);
