import styled from "styled-components";

export const ButtonGroup = styled.div`
    display: flex;
    justify-content: stretch;
    margin-bottom: 15px;
    width: 100%;

    button {
        flex: 1 0 auto;

        &:first-child {
            border-right: none;
        }
    }
`;
