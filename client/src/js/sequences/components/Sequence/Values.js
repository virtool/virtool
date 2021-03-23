import React from "react";
import styled from "styled-components";

export const SequenceValue = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;

    p,
    small {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small {
        color: ${props => props.theme.color.greyDark};
        font-size: ${props => props.theme.fontSize.sm};
        font-weight: bold;
        text-transform: uppercase;
    }
`;

export const StyledSequenceTitleValue = styled(SequenceValue)`
    flex: 1;
`;

export const SequenceTitleValue = ({ label, value }) => (
    <StyledSequenceTitleValue>
        <p>{value}</p>
        <small>{label}</small>
    </StyledSequenceTitleValue>
);

const StyledSequenceAccessionValue = styled(SequenceValue)`
    width: 100px;
    margin-right: 20px;
`;

export const SequenceAccessionValue = ({ accession }) => (
    <StyledSequenceAccessionValue>
        <p>{accession}</p>
        <small>ACCESSION</small>
    </StyledSequenceAccessionValue>
);
