import { find, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { fontWeight } from "../../../app/theme";
import {
    Box,
    InputError,
    InputGroup,
    InputLabel,
    ListboxButton,
    ListboxInput,
    ListboxList,
    ListboxOption,
    ListboxPopover
} from "../../../base";
import { getHasSchema, getOTUDetailId, getSchema } from "../../../otus/selectors";
import { getReferenceDetailId } from "../../../references/selectors";
import { getUnreferencedSegments } from "../../selectors";
import { SequenceSegment } from "./Segment";

const NoSchema = styled(Box)`
    align-items: center;
    display: flex;
    justify-content: space-between;

    a,
    h5 {
        font-weight: ${fontWeight.thick};
    }

    h5 {
        margin: 0 0 5px;
    }

    p {
        margin: 0;
    }
`;

export const SequenceSegmentField = ({ error, hasSchema, otuId, value, refId, segmentValue, segments, onChange }) => {
    if (hasSchema) {
        const segmentOptions = map(segments, segment => (
            <ListboxOption key={segment.name} value={segment.name}>
                <SequenceSegment name={segment.name} required={segment.required} />
            </ListboxOption>
        ));

        return (
            <InputGroup>
                <InputLabel>Segment</InputLabel>
                <ListboxInput value={value || "None"} onChange={value => onChange(value === "None" ? null : value)}>
                    <ListboxButton>
                        <SequenceSegment name={segmentValue.name} required={segmentValue.required} />
                    </ListboxButton>
                    <ListboxPopover>
                        <ListboxList>
                            <ListboxOption key="None" value="None">
                                <SequenceSegment name="None" />
                            </ListboxOption>
                            {segmentOptions}
                        </ListboxList>
                    </ListboxPopover>
                </ListboxInput>
                <InputError>{error}</InputError>
            </InputGroup>
        );
    }

    return (
        <InputGroup>
            <InputLabel>Segment</InputLabel>
            <NoSchema>
                <div>
                    <h5>No schema is defined for this OTU.</h5>
                    <p>A schema defines the sequence segments that should be present in isolates of the OTU. </p>
                </div>
                <div>
                    <Link to={`/refs/${refId}/otus/${otuId}/schema`}>Add a Schema</Link>
                </div>
            </NoSchema>
        </InputGroup>
    );
};

export const mapStateToProps = (state, ownProps) => ({
    hasSchema: getHasSchema(state),
    otuId: getOTUDetailId(state),
    refId: getReferenceDetailId(state),
    segmentValue: find(getSchema(state), { name: ownProps.value }) || { name: "None" },
    segments: getUnreferencedSegments(state)
});

export default connect(mapStateToProps)(SequenceSegmentField);
