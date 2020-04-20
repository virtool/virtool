import { map, some } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroup, NoneFoundBox } from "../../../base";
import { IndexSelectorItem } from "./IndexSelectorItem";

const StyledIndexSelectorList = styled.div`
    border: 1px solid ${props => (props.error.length ? "#d44b40" : "transparent")};
    max-height: 165px;
    overflow-y: auto;
`;

export const IndexSelectorList = ({ error, indexes, selected, onSelect }) => {
    if (indexes.length) {
        const indexComponents = map(indexes, index => {
            const isSelected = some(selected, { id: index.id });
            return <IndexSelectorItem key={index.id} {...index} isSelected={isSelected} onSelect={onSelect} />;
        });

        return (
            <BoxGroup>
                <StyledIndexSelectorList error={error}>{indexComponents}</StyledIndexSelectorList>
            </BoxGroup>
        );
    }

    return <NoneFoundBox noun="built references" />;
};
