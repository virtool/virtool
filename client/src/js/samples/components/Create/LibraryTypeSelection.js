import React from "react";
import styled from "styled-components";

import { SelectBox } from "../../../base";

const Title = styled.div`
    margin-bottom: 5px;
    font-weight: bold;
`;
const LibraryTypeSelectBoxContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 11px;
`;

export const LibraryTypeSelection = ({ onSelect, libraryType }) => (
    <div>
        <Title>Library Type</Title>
        <LibraryTypeSelectBoxContainer>
            <SelectBox onClick={() => onSelect("Normal")} active={libraryType === "Normal"}>
                Normal
            </SelectBox>

            <SelectBox onClick={() => onSelect("sRNA")} active={libraryType === "sRNA"}>
                sRNA
            </SelectBox>

            <SelectBox onClick={() => onSelect("Amplicon")} active={libraryType === "Amplicon"}>
                Amplicon
            </SelectBox>
        </LibraryTypeSelectBoxContainer>
    </div>
);
