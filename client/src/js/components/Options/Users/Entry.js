/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserEntry
 */

import React from "react";
import { ListGroupItem } from "virtool/js/components/Base";

/**
 * A component based on ListGroupItem
 */
const UserEntry = (props) => (
    <ListGroupItem active={props.active} onClick={() => props.onClick(props._id)}>
        {props._id}
    </ListGroupItem>
);

UserEntry.propTypes = {
    _id: React.PropTypes.string.isRequired,
    active: React.PropTypes.bool,
    onClick: React.PropTypes.func.isRequired
};

UserEntry.defaultProps = {
    active: false
};

export default UserEntry;

