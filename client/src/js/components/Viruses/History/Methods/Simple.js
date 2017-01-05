/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddMethod, RemoveMethod, VerifyVirusMethod, SetFieldMethod, SetDefaultIsolateMethod
 */

import React from "react";
import { find } from "lodash";
import { Icon } from "virtool/js/components/Base/Icon";
import { formatIsolateName } from "virtool/js/utils";
import { MethodBase, changesPropTypes, annotationPropTypes } from "./Base";

/**
 * A history method component for adding a virus.
 *
 * @class
 */
export const AddMethod = (props) => (
    <MethodBase {...props} iconName="new-entry" bsStyle="primary" verb="Added" />
);

AddMethod.propTypes = changesPropTypes;


/**
 * A history method component for removing a virus.
 *
 * @class
 */
export const RemoveMethod = (props) => (
    <MethodBase {...props} iconName="remove" bsStyle="danger" verb="Removed" />
);

RemoveMethod.propTypes = changesPropTypes;


/**
 * A component that describes the verification of a virus within a HistoryItem.
 *
 * @class
 */
export const VerifyVirusMethod = () => (
    <span><Icon name="checkmark" bsStyle="success"/> Verified</span>
);


/**
 * A component that describes a change in a virus field: name or abbreviation.
 *
 * @class
 */
export const SetFieldMethod = (props) => {

    const fieldChange = find(props.changes, change => change[1] == "abbreviation" || change[1] == "name");

    let message;

    if (fieldChange[2][1]) {
        message = <span>Changed virus {fieldChange[1]} to <em>{fieldChange[2][1]}</em></span>;
    } else {
        message = <span>Removed abbreviation</span>;
    }

    return <span><Icon name="pencil" bsStyle="warning" /> {message}</span>;
};

SetFieldMethod.propTypes = changesPropTypes;


/**
 * Describe a change in default isolate. Tells what the new default isolate is.
 *
 * @class
 */
export const SetDefaultIsolateMethod = (props) => (
    <span>
        <Icon name="lab" bsStyle="warning" />
        <span> Changed default isolate to </span>
        <em>{formatIsolateName(props.annotation)} ({props.annotation.isolate_id})</em>
    </span>
);

SetDefaultIsolateMethod.propTypes = annotationPropTypes;
