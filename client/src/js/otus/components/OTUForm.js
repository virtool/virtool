import React from "react";
import { Row, Col } from "react-bootstrap";
import { InputError, SaveButton, DialogBody, DialogFooter } from "../../base";

const OTUForm = props => (
    <form onSubmit={props.handleSubmit}>
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
            <SaveButton pullRight />
        </DialogFooter>
    </form>
);

export default OTUForm;
