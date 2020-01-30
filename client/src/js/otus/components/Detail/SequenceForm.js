import React from "react";
import { Row, Col, Modal } from "react-bootstrap";

import { SaveButton, InputError } from "../../../base";
import SequenceField from "./SequenceField";

const SegmentForm = props => (
    <form onSubmit={props.handleSubmit}>
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
            <SaveButton />
        </Modal.Footer>
    </form>
);

export default SegmentForm;
