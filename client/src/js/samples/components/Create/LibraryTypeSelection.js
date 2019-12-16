import React from "react";
import styled from "styled-components";

import { SelectBox } from "../../../base";

const LibraryTypeSelectBoxContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 15px;
`;

export const LibraryTypeSelection = ({ onSelect, libraryType }) => (
    <React.Fragment>
        <label>Library Type</label>
        <LibraryTypeSelectBoxContainer>
            <SelectBox onClick={() => onSelect("normal")} active={libraryType === "normal"}>
                <div>Normal</div>
                <span>Search against whole genome references using normal reads.</span>
            </SelectBox>

            <SelectBox onClick={() => onSelect("srna")} active={libraryType === "srna"}>
                <div>sRNA</div>
                <span>Search against whole genome references using sRNA reads</span>
            </SelectBox>

            <SelectBox onClick={() => onSelect("amplicon")} active={libraryType === "amplicon"}>
                <div>Amplicon</div>
                <span>Search against barcode references using amplicon reads.</span>
            </SelectBox>
        </LibraryTypeSelectBoxContainer>
    </React.Fragment>
);
