import React from "react";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { Icon } from "./Icon";

export const NoneFound = ({ noun, noListGroup }) => {
    const item = (
        <ListGroupItem className="text-center">
            <Icon name="info"/> No {noun} found
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
