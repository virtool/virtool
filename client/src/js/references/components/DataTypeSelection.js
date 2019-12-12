import React from "react";
import styled from "styled-components";
import { SelectBox } from "../../base";

const SelectBoxContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 11px;
`;

export const DataTypeSelection = ({ onSelect, dataType }) => (
    <div>
        <label>Data Type</label>
        <SelectBoxContainer>
            <SelectBox onClick={() => onSelect("genome")} active={dataType === "genome"}>
                <div>Genome</div>
                <span>Whole genomes for mapping-based detection</span>
            </SelectBox>
            <SelectBox onClick={() => onSelect("barcode")} active={dataType === "barcode"}>
                <div>Barcode</div>
                <span>Target sequences for barcode analysis</span>
            </SelectBox>
        </SelectBoxContainer>
    </div>
);
