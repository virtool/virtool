/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveSequenceMethod
 */

import React from "react";
import { find } from "lodash";
import { Icon } from "virtool/js/components/Base";
import { formatIsolateName } from "virtool/js/utils";
import { MethodWithModal, SequenceReader, bothPropTypes } from "./Base";

/**
 * A text element and modal component that show the details of a sequence removed by the remove_sequence method.
 *
 * @class
 */
export const RemoveSequenceMethod = (props) => {

    // Extract the sequence from the history document.
    const sequence = find(props.changes, change => change[0] == "remove")[2][0][1];

    // Calculate an isolate name.
    const isolateName = formatIsolateName(props.annotation);

    // A message shown in the HistoryItem and the detail modal that describes the change.
    const message = (
        <span>
            <Icon name="dna" bsStyle="danger" /> Removed sequence {sequence._id} from <em>{isolateName}</em>
        </span>
    );

    return (
        <MethodWithModal message={message}>
            <SequenceReader sequence={sequence} />
        </MethodWithModal>
    );
};

RemoveSequenceMethod.propTypes = bothPropTypes;
