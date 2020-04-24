import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { InputError, InputGroup, InputLabel, Select } from "../../../../base";
import { getAvailableSegmentNames } from "../../../selectors";

const SegmentSelectDefault = () => <option value="">None</option>;

export const SequenceSegment = ({ value, onChange, error, segmentNames }) => {
    const segmentOptions = map(segmentNames, segment => (
        <option key={segment} value={segment}>
            {segment}
        </option>
    ));

    return (
        <InputGroup>
            <InputLabel>Segment</InputLabel>
            <Select name="segment" value={value} onChange={onChange}>
                <SegmentSelectDefault key="None" />
                {segmentOptions}
            </Select>
            <InputError>{error}</InputError>
        </InputGroup>
    );
};

export const mapStateToProps = state => ({
    segmentNames: getAvailableSegmentNames(state)
});

export default connect(mapStateToProps)(SequenceSegment);
