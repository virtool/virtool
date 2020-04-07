import styled from "styled-components";

export const ButtonGroup = styled.div`
    display: flex;
    justify-content: stretch;
    margin-bottom: 15px;
    width: 100%;

    button {
        border-radius: 0;
        flex: 1 0 auto;

        &:first-child {
            border-bottom-left-radius: ${props => props.theme.borderRadius.sm};
            border-top-left-radius: ${props => props.theme.borderRadius.sm};
        }

        &:not(:last-child) {
            border-right: none;
        }

        &:last-child {
            border-bottom-right-radius: ${props => props.theme.borderRadius.sm};
            border-top-right-radius: ${props => props.theme.borderRadius.sm};
        }
    }
`;
