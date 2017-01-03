/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpsertIsolateMethod
 */

import React from "react";
import { find, filter, clone, forEach } from "lodash-es";
import { Icon } from "virtool/js/components/Base";
import { formatIsolateName } from "virtool/js/utils";
import { changesPropTypes, bothPropTypes } from "./Base";

export const IsolateAddition = ({changes}) => {

    const isolate = find(changes, change => change[1] == "isolates" || change[1][0] == "isolates")[2][0][1];

    return (
        <span>
            <Icon name="lab" bsStyle="primary" />
            <span> Added isolate <em>{formatIsolateName(isolate)} ({isolate.isolate_id})</em></span>
        </span>
    );
};

IsolateAddition.propTypes = changesPropTypes;


export const IsolateRename = (props) => {

    // The old isolate object is stored in the history document annotation.
    const oldIsolateName = formatIsolateName(props.annotation);

    // Get the changes that were applied to the isolate.
    const isolateChanges = filter(props.changes, change => change[1][0] == "isolates");

    // Clone the old isolate object to use as a basis for constructing the new one from the changes.
    const newIsolate = clone(props.annotation);

    // Change the newIsolate object using the changes array.
    forEach(isolateChanges, change => {
        if (change[1][2] === "source_type") {
            newIsolate.source_type = change[2][1];
        }
        if (change[1][2] === "source_name") {
            newIsolate.source_name = change[2][1];
        }
    });

    return (
        <span>
            <Icon name="lab" bsStyle="warning" />
            <span> Renamed <em>{oldIsolateName}</em> to </span>
            <em>
                {formatIsolateName(newIsolate)} ({props.annotation.isolate_id})
            </em>
        </span>
    );
};

IsolateRename.propTypes = bothPropTypes;


/**
 * A component that renders either IsolateRename or IsolateAddition as a subcomponent.
 *
 * @class
 */
export const UpsertIsolateMethod = (props) => {
    if (props.annotation) {
        return <IsolateRename changes={props.changes} annotation={props.annotation} />;
    }

    return <IsolateAddition changes={props.changes} />;
};

UpsertIsolateMethod.propTypes = {
    changes: React.PropTypes.array,
    annotation: React.PropTypes.object
};
