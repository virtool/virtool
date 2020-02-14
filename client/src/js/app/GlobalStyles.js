import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`    
    body {
        font-family: "Roboto", sans-serif;
        height: calc(100vh - 40px);
        overflow-y: scroll;
        padding-top: 65px;
    }
`;
