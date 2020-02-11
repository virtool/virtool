import React from "react";
import { Row, Col } from "react-bootstrap";

import { SaveButton, InputError, DialogBody, DialogFooter } from "../../../base";
import SequenceField from "./SequenceField";

const SegmentForm = props => (
    <form onSubmit={props.handleSubmit}>
        <DialogBody>
            {props.overlay}
            <Row>{props.AccessionSegmentCol}</Row>
            <Row>
                <Col xs={12}>
                    <InputError label="Host" name="host" value={props.host} onChange={props.handleChange} />
                </Col>
            </Row>
            <Row>
                <Col xs={12}>
                    <InputError
                        label="Definition"
                        name="definition"
                        value={props.definition}
                        onChange={props.handleChange}
                        error={props.errorDefinition}
                    />
                </Col>
            </Row>
            <Row>
                <Col xs={12}>
                    <SequenceField
                        name="sequence"
                        sequence={props.sequence}
                        onChange={props.handleChange}
                        error={props.errorSequence}
                    />
                </Col>
            </Row>
        </DialogBody>
        <DialogFooter>
            <SaveButton />
        </DialogFooter>
    </form>
);

export default SegmentForm;
