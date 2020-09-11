import { map, some } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroup, NoneFoundBox } from "../../../base";
import { IndexSelectorItem } from "./IndexSelectorItem";

const StyledIndexSelectorList = styled(BoxGroup)`
    ${props => (props.error.length ? `border-color: ${props.theme.color.redDark};` : "")};
    max-height: 165px;
    overflow-y: auto;
`;

export const IndexSelector = ({ error, indexes, selected, onSelect }) => {
    let content;

    if (indexes.length) {
        const indexComponents = map(indexes, index => {
            const isSelected = some(selected, { id: index.id });
            return <IndexSelectorItem key={index.id} {...index} isSelected={isSelected} onSelect={onSelect} />;
        });

        content = <StyledIndexSelectorList error={error}>{indexComponents}</StyledIndexSelectorList>;
    } else {
        content = <NoneFoundBox noun="built references" />;
    }

    return (
        <React.Fragment>
            <label>References</label>
            {content}
        </React.Fragment>
    );
};
