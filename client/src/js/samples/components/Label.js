import React from "react";
import styled from "styled-components";
import { borderRadius, getBorder, getFontSize, getFontWeight } from "../../app/theme";
import { Icon } from "../../base";
import { getLibraryTypeDisplayName } from "../utils";

export const StyledSampleLabel = styled.span`
    align-items: center;
    background-color: ${props => props.theme.color.white};
    border: ${getBorder};
    border-radius: ${borderRadius.md};
    display: inline-flex;
    padding: 4px 8px;

    i.fas {
        color: ${props => props.color};
        margin-right: 5px;
    }
`;

const StyledSampleLibraryTypeLabel = styled(StyledSampleLabel)`
    background-color: #e5e7eb;
    font-size: ${getFontSize("sm")};
    font-weight: ${getFontWeight("thick")};
    padding: 2px 7px 2px 5px;

    i.fas {
        margin-right: 3px;
    }
`;

export const SampleLibraryTypeLabel = ({ libraryType }) => (
    <StyledSampleLibraryTypeLabel>
        <Icon name={libraryType === "amplicon" ? "barcode" : "dna"} />
        <span>{getLibraryTypeDisplayName(libraryType)}</span>
    </StyledSampleLibraryTypeLabel>
);

export const SampleLabel = styled(({ className, color, name, role }) => (
    <StyledSampleLabel className={className} color={color} role={role}>
        <Icon name="circle" />
        {name}
    </StyledSampleLabel>
))``;

export const SmallSampleLabel = styled(SampleLabel)`
    font-size: ${getFontSize("sm")};
    padding: 2px 7px 2px 5px;

    i.fas {
        margin-right: 3px;
    }
`;
