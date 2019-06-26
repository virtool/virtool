import styled from "styled-components";

export const Toolbar = styled.div`
    display: flex;
    align-items: stretch;
    margin-bottom: 15px;

    .form-group {
        margin-bottom: 0 !important;
        flex: auto;
    }

    & > * {
        margin-left: 3px;
    }

    & > *:first-child {
        margin-left: 0;
    }

    & > .btn-group {
        display: flex;
        align-items: stretch;
        margin-left: 3px;
        flex: 0 0 auto;
    }
`;
