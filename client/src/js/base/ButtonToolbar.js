import styled from "styled-components";

export const ButtonToolbar = styled.div`
    align-items: center;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 10px;

    button {
        margin-left: 5px;

        button:first-child {
            margin: 0;
        }
    }
`;
