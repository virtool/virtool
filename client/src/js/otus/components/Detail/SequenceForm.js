import React from "react";
import { Row, Col, Modal } from "react-bootstrap";
import { map, concat } from "lodash-es";
import { SaveButton, InputError } from "../../../base";
import SequenceField from "./SequenceField";

const SegmentForm = props => {
  const defaultOption = (
    <option key="None" value="">
      {" "}
      - None -{" "}
    </option>
  );
  const segmentNames = concat(
    defaultOption,
    map(props.schema, segment => (
      <option key={segment} value={segment}>
        {segment}
      </option>
    ))
  );

  return (
    <React.Fragment>
      <form onSubmit={props.handleSubmit}>
        <Modal.Body>
          {props.overlay}
          <Row>
            {props.accessionCol}
            <Col xs={12} md={6}>
              <InputError
                type="select"
                label="Segment"
                name="segment"
                value={props.segment}
                onChange={props.handleChange}
                error={props.errorSegment}
              >
                {segmentNames}
              </InputError>
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <InputError
                label="Host"
                name="host"
                value={props.host}
                onChange={props.handleChange}
              />
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
    </React.Fragment>
  );
};

export default SegmentForm;
