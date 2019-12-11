import React from "react";
import { SelectBox, SelectBoxContainer } from "../../base";

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
