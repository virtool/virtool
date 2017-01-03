/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpdateSequenceMethod
 */

import React from "react";
import { capitalize, filter } from "lodash-es";
import { ListGroup } from "react-bootstrap";
import { ListGroupItem, Icon, Input } from "virtool/js/components/Base"
import { formatIsolateName } from "virtool/js/utils";
import { MethodWithModal, bothPropTypes } from "./Base";

/**
 * Describes a change in a single field of a sequence record. Shows the value before the change, an arrow, and the
 * value after the change.
 *
 * @class
 */
const SingleFieldChange = (props) => {

    // The capitalized name of the field affected the change.
    const fieldName = capitalize(props.change[1][4]);

    // The values before the change and after.
    const oldValue = props.change[2][0];
    const newValue = props.change[2][1];

    // Props that are the same for the before and after input fields.
    const sharedProps = {
        type: fieldName === "Sequence" ? "textarea": "text",
        rows: fieldName === "Sequence" ? 5: null,
        readOnly: true
    };

    return (
        <ListGroupItem>
            <Input
                {...sharedProps}
                label={fieldName}
                value={oldValue}
            />

            <div className="text-center" style={{marginBottom: "15px"}}>
                <Icon name="arrow-down" />
            </div>

            <Input
                {...sharedProps}
                value={newValue}
            />
        </ListGroupItem>
    );
};

SingleFieldChange.propTypes = {
    change: React.PropTypes.array
};

/**
 * A text element briefly describing changes made by update_sequence. A modal can be opened containing further detail.
 *
 * @class
 */
export const UpdateSequenceMethod = (props) => {

    // Get a the change description tuples from props.
    const changes = filter(props.changes, change => change[1] !== "_version" && change[1] !== "modified");

    // Construct a Change component for each change tuple.
    const changeComponents = changes.map((change, index) => (
        <SingleFieldChange key={index} change={change} number={index + 1} />
    ));

    const isolateName = formatIsolateName(props.annotation);

    // A message that will describe the change in the HistoryItem component and serve as the title for the detail
    // modal.
    const message = (
        <span>
            <Icon name="dna" bsStyle="warning" /> Updated sequence {this.props.annotation._id} in
            <em> {isolateName} ({props.annotation.isolate_id}) </em>
        </span>
    );

    return (
        <MethodWithModal message={message}>
            <ListGroup fill>
                {changeComponents}
            </ListGroup>
        </MethodWithModal>
    );
};

UpdateSequenceMethod.propTypes = bothPropTypes;
