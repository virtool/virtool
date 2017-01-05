/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveIsolateMethod
 */

import React from "react";
import { capitalize, find } from "lodash";
import { Row, Col, Badge, InputGroup, Panel, PanelGroup } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";
import { formatIsolateName } from "virtool/js/utils";
import { MethodWithModal, SequenceReader, bothPropTypes } from "./Base";

export const RemoveIsolateMethod = (props) => {

    // Get the part of the changes object that describes the change in the isolates.
    const fieldChange = find(props.changes, function (change) {
        return change[1] == "isolates";
    });

    // Get the isolate from the change data.
    const isolate = fieldChange[2][0][1];

    // Parse out the isolate name from the isolate object.
    const isolateName = formatIsolateName(isolate);

    // Make a message describing the basics of the change which will be shown in the HistoryItem and the modal
    // title.
    const message = (
        <span>
            <Icon name="lab" bsStyle="danger" /> Removed isolate
            <em> {isolateName} ({isolate.isolate_id})</em>
        </span>
    );

    const sequenceComponents = isolate.sequences.map((document, index) => (
        <Panel key={index} eventKey={index} header={document._id}>
            <SequenceReader sequence={document} />
        </Panel>
    ));

    return (
        <MethodWithModal message={message}>
            <Row>
                <Col md={6}>
                    <InputGroup
                        type="text"
                        label="Source Type"
                        value={capitalize(this.props.isolate.source_type)}
                        readOnly
                    />
                </Col>
                <Col md={6}>
                    <InputGroup
                        type="text"
                        label="Source Name"
                        value={this.props.isolate.source_name}
                        readOnly
                    />
                </Col>
            </Row>
            <h5>
                <Icon name="dna" /> <strong>Sequences </strong>
                <Badge>{sequenceComponents.length}</Badge>
            </h5>
            <PanelGroup defaultActiveKey={0} accordion>
                {sequenceComponents}
            </PanelGroup>
        </MethodWithModal>
    );
};

RemoveIsolateMethod.propTypes = bothPropTypes;
