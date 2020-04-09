import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";
import { DropdownButton, DropdownItem, Icon } from "../../../base";

const algorithmSortKeys = {
    aodp: ["identity"],
    pathoscope: ["coverage", "depth", "weight"],
    nuvs: ["length", "e", "orfs"]
};

const StyledSortDropdownButtonTitle = styled.div`
    align-items: center;
    display: flex;
    width: ${props => sortWidths[props.algorithm]};

    i {
        margin-left: auto;
    }
`;

const sortTitles = {
    coverage: "Coverage",
    depth: "Depth",
    e: "E-Value",
    length: "Length",
    orfs: "ORFs",
    weight: "Weight",
    identity: "Identity"
};

const sortWidths = {
    aodp: "110px",
    pathoscope: "122px",
    nuvs: "110px"
};

export const AnalysisViewerSort = ({ algorithm, onSelect, sortKey }) => {
    const options = map(algorithmSortKeys[algorithm], key => (
        <DropdownItem key={key} onClick={() => onSelect(key)}>
            {sortTitles[key]}
        </DropdownItem>
    ));

    return (
        <DropdownButton
            id={`${algorithm}-sort-dropdown`}
            title={
                <StyledSortDropdownButtonTitle algorithm={algorithm}>
                    <span>
                        <Icon name="sort" /> Sort: {sortTitles[sortKey]}
                    </span>
                    <Icon name="caret-down" />
                </StyledSortDropdownButtonTitle>
            }
        >
            {options}
        </DropdownButton>
    );
};
