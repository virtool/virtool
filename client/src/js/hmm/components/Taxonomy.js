import { map, sortBy } from "lodash-es";
import React from "react";
import { Badge, ListGroup } from "react-bootstrap";
import { ListGroupItem } from "../../base";

export const HMMTaxonomy = ({ counts }) => {
    const sorted = sortBy(map(counts, (count, name) => ({ name, count })), "name");

    const components = map(sorted, ({ name, count }) => (
        <ListGroupItem key={name}>
            {name} <Badge>{count}</Badge>
        </ListGroupItem>
    ));

    return <ListGroup style={{ maxHeight: 210, overflowY: "auto" }}>{components}</ListGroup>;
};
