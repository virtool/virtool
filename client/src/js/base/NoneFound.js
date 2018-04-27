import React from "react";
import PropTypes from "prop-types";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { Icon } from "./Icon";

/**
 * A ListGroupItem component with a 'none found'-type message. Used in ListGroups when no data is available to populate
 * the list. For example, when no sample have been created.
 *
 * @param noun {string} the name of the items of which none were found (eg. samples)
 * @param noListGroup {boolean} don't include a ListGroup in the returned element
 */
export const NoneFound = ({ noun, noListGroup }) => {
    const item = (
        <ListGroupItem className="text-center">
            <Icon name="info" /> No {noun} found
        </ListGroupItem>
    );

    if (noListGroup) {
        return item;
    }

    return (
        <ListGroup>
            {item}
        </ListGroup>
    );
};

NoneFound.propTypes = {
    noun: PropTypes.string.isRequired,
    noListGroup: PropTypes.bool
};
