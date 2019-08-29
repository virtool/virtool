import styled from "styled-components";

export const Label = styled.span`
    background-color: #777777;
    border-radius: 2px;
    color: #ffffff;
    display: inline;
    font-size: 12px;
    font-weight: bold;
    padding: 3px 5px;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;

    ${props => (props.spaced ? "margin-right: 5px;" : "")}

    &:last-of-type {
        margin: 0;
    }
`;

export const PrimaryLabel = styled(Label)`
    background-color: #07689d;
`;

export const DangerLabel = styled(Label)`
    background-color: #c53030;
`;

export const InfoLabel = styled(Label)`
    background-color: #553c9a;
`;

export const SuccessLabel = styled(Label)`
    background-color: #2f855a;
`;
