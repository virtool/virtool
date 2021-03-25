import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { borderRadius, getFontSize } from "../../../app/theme";
import { Icon, Loader } from "../../../base";

const SampleItemLabelIcon = styled.span`
    margin-right: 3px;
    width: 12px;
`;

const StyledSampleItemWorkflowTag = styled.div`
    align-items: center;
    background-color: ${props => props.theme.color.purpleDarkest};
    color: ${props => props.theme.color.white};
    display: flex;
    font-size: ${getFontSize("sm")};
    font-weight: bold;
    padding: 3px 8px;

    &:first-child {
        border-top-left-radius: ${borderRadius.sm};
        border-bottom-left-radius: ${borderRadius.sm};
    }

    &:last-child {
        border-top-right-radius: ${borderRadius.sm};
        border-bottom-right-radius: ${borderRadius.sm};
    }

    &:not(:last-child),
    &:not(:only-child) {
        border-right: 2px solid ${props => props.theme.color.purple};
    }

    i.fas {
        line-height: inherit;
    }

    span:last-child {
        margin-left: 3px;
    }
`;

export const SampleItemWorkflowTag = ({ label, pending }) => (
    <StyledSampleItemWorkflowTag pending={pending}>
        <SampleItemLabelIcon>
            {pending ? (
                <Loader size="10px" color="white" verticalAlign="middle" />
            ) : (
                <Icon name="check-circle" style={{ lineHeight: "inherit" }} fixedWidth />
            )}
        </SampleItemLabelIcon>
        <span>{label}</span>
    </StyledSampleItemWorkflowTag>
);

const SampleItemWorkflowTagLink = styled(StyledSampleItemWorkflowTag)`
    background-color: ${props => props.theme.color.purple};
    border-left: none;
`;

const SampleItemWorkflowTagNone = styled(StyledSampleItemWorkflowTag)`
    background-color: #ec4899;
`;

const StyledSampleWorkflowTags = styled.div`
    align-items: center;
    display: flex;
    flex: 2;
`;

const SampleItemWorkflowTagsContainer = styled.div`
    align-items: stretch;
    display: flex;
`;

export const SampleItemWorkflowTags = ({ id, nuvs, pathoscope }) => (
    <StyledSampleWorkflowTags>
        <SampleItemWorkflowTagsContainer>
            {!pathoscope && !nuvs && (
                <SampleItemWorkflowTagNone>
                    <SampleItemLabelIcon>
                        <Icon name="times-circle" fixedWidth />
                    </SampleItemLabelIcon>
                    <span>No Analyses</span>
                </SampleItemWorkflowTagNone>
            )}
            {pathoscope && <SampleItemWorkflowTag label="Pathoscope" pending={pathoscope === "ip"} />}
            {nuvs && <SampleItemWorkflowTag label="NuVs" pending={nuvs === "ip"} />}
            <SampleItemWorkflowTagLink as={Link} to={`/samples/${id}/analyses`}>
                View
            </SampleItemWorkflowTagLink>
        </SampleItemWorkflowTagsContainer>
    </StyledSampleWorkflowTags>
);
