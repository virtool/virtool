import React from "react";
import styled from "styled-components";
import { SaveButton, InputError, DialogBody, DialogFooter } from "../../../base";
import SequenceField from "./SequenceField";

const OverlaySegment = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 13px;
`;

const SegmentForm = props => (
    <form onSubmit={props.handleSubmit}>
        <DialogBody>
            <OverlaySegment>{props.overlay}</OverlaySegment>
            {props.AccessionSegmentCol}

            <InputError label="Host" name="host" value={props.host} onChange={props.handleChange} />

            <InputError
                label="Definition"
                name="definition"
                value={props.definition}
                onChange={props.handleChange}
                error={props.errorDefinition}
            />

            <SequenceField
                name="sequence"
                sequence={props.sequence}
                onChange={props.handleChange}
                error={props.errorSequence}
            />
        </DialogBody>
        <DialogFooter>
            <SaveButton />
        </DialogFooter>
    </form>
);

export default SegmentForm;
