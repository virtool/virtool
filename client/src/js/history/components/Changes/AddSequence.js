/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddSequenceMethod
 */

import React from "react";
import { find } from "lodash";
import { formatIsolateName } from "virtool/js/utils";
import { Icon } from "virtool/js/components/Base";
import { MethodWithModal, SequenceReader, bothPropTypes } from "./Base";

/**
 * A description of the change made by the add_sequence method. Can display a modal showing the added sequence.
 *
 * @class
 */
export const AddSequenceMethod = (props) => {

    // Extract the added sequence from the history document.
    const sequence = find(props.changes, change => change[0] == "add")[2][0][1];

    // Calculate an isolate from the source type and name.
    const isolateName = formatIsolateName(props.annotation);

    // A message that is shown both in the element describing the change in the HistoryItem and as the title for the
    // change detail modal.
    const message = (
        <span>
            <Icon name="dna" bsStyle="primary" /> Added sequence {sequence._id} to <em>{isolateName}</em>
        </span>
    );

    return (
        <MethodWithModal message={message}>
            <SequenceReader sequence={sequence} />
        </MethodWithModal>
    );
};

AddSequenceMethod.propTypes = bothPropTypes;
