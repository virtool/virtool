import React from "react";
import styled from "styled-components";
import { getFontSize } from "../../../app/theme";
import { Icon, Loader } from "../../../base";

const SampleItemLabelIcon = styled.span`
    margin-right: 3px;
    width: 12px;
`;

const StyledSampleItemLabel = styled.div`
    align-items: center;
    background-color: ${props => props.theme.color[props.ready ? "blueDark" : "white"]};
    border: 1px solid ${props => props.theme.color[props.ready ? "blueDark" : "greyLight"]};
    border-radius: 2px;
    color: ${props => props.theme.color[props.ready ? "white" : "greyDarkest"]};
    display: flex;
    font-size: ${getFontSize("sm")};
    font-weight: bold;
    padding: 2px 4px;

    &:not(:last-child) {
        margin-right: 5px;
    }

    span:last-child {
        margin-left: 3px;
    }
`;

export const SampleItemLabel = ({ label, ready }) => (
    <StyledSampleItemLabel ready={ready}>
        <SampleItemLabelIcon>
            {ready === "ip" ? (
                <Loader size="10px" color="white" verticalAlign="middle" />
            ) : (
                <Icon name="chart-area" style={{ lineHeight: "inherit" }} fixedWidth />
            )}
        </SampleItemLabelIcon>
        <span>{label}</span>
    </StyledSampleItemLabel>
);

const StyledSampleItemLabels = styled.div`
    align-items: center;
    display: flex;
    flex: 2;
`;

export const SampleItemLabels = ({ nuvs, pathoscope }) => (
    <StyledSampleItemLabels>
        <SampleItemLabel label="Pathoscope" ready={pathoscope} />
        <SampleItemLabel label="NuVs" ready={nuvs} />
    </StyledSampleItemLabels>
);
