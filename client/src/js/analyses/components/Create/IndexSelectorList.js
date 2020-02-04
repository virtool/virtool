import { map, some } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { NoneFound, BoxGroup } from "../../../base";
import { IndexSelectorItem } from "./IndexSelectorItem";

const StyledIndexSelectorList = styled(BoxGroup)`
    border: 1px solid ${props => (props.error.length ? "#d44b40" : "transparent")};
    max-height: 165px;
    overflow-y: auto;
    margin-bottom: 3px;
`;

export const IndexSelectorList = ({ error, indexes, selected, onSelect }) => {
    if (indexes.length) {
        const indexComponents = map(indexes, index => {
            const isSelected = some(selected, { id: index.id });
            return <IndexSelectorItem key={index.id} {...index} isSelected={isSelected} onSelect={onSelect} />;
        });

        return <StyledIndexSelectorList error={error}>{indexComponents}</StyledIndexSelectorList>;
    }

    return <NoneFound />;
};
