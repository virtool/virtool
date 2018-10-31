import React from "react";
import { Row, Col, Modal } from "react-bootstrap";
import { InputError, SaveButton } from "../../base";

const OTUForm = props => (
    <form onSubmit={props.handleSubmit}>
        <Modal.Body>
            <Row>
                <Col md={8}>
                    <InputError
                        label="Name"
                        name="name"
                        value={props.name}
                        onChange={props.handleChange}
                        error={props.errorName}
                    />
                </Col>
                <Col md={4}>
                    <InputError
                        label="Abbreviation"
                        name="abbreviation"
                        value={props.abbreviation}
                        onChange={props.handleChange}
                        error={props.errorAbbreviation}
                    />
                </Col>
            </Row>
        </Modal.Body>
        <Modal.Footer>
            <SaveButton pullRight />
        </Modal.Footer>
    </form>
);

export default OTUForm;
