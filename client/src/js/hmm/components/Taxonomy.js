import { map, sortBy } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { ListGroup } from "react-bootstrap";
import { Badge, ListGroupItem } from "../../base";

const HMMTaxonomyItem = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

export const HMMTaxonomy = ({ counts }) => {
    const sorted = sortBy(map(counts, (count, name) => ({ name, count })), "name");

    const components = map(sorted, ({ name, count }) => (
        <HMMTaxonomyItem key={name}>
            {name} <Badge>{count}</Badge>
        </HMMTaxonomyItem>
    ));

    return <ListGroup style={{ maxHeight: 210, overflowY: "auto" }}>{components}</ListGroup>;
};
