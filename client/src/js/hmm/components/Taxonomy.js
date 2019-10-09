import { map, sortBy } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { Badge, BoxGroup, BoxGroupSection } from "../../base";

const HMMTaxonomyItem = styled(BoxGroupSection)`
    display: flex;
    justify-content: space-between;
`;

const StyledHMMTaxonomy = styled(BoxGroup)`
    max-height: 210px;
    overflow-y: auto;
`;

export const HMMTaxonomy = ({ counts }) => {
    const sorted = sortBy(map(counts, (count, name) => ({ name, count })), "name");

    const components = map(sorted, ({ name, count }) => (
        <HMMTaxonomyItem key={name}>
            {name} <Badge>{count}</Badge>
        </HMMTaxonomyItem>
    ));

    return <StyledHMMTaxonomy>{components}</StyledHMMTaxonomy>;
};
