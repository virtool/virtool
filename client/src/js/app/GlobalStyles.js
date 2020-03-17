import { createGlobalStyle, css } from "styled-components";

export const tabFocus = css`
    // WebKit-specific. Other browsers will keep their default outline style.
    // (Initially tried to also force default via \`outline: initial\`,
    // but that seems to erroneously remove the outline in Firefox altogether.)
    outline: 5px auto -webkit-focus-ring-color;
    outline-offset: -2px;
`;

export const GlobalStyles = createGlobalStyle`
    body {
        font-family: "Roboto", sans-serif;
        height: calc(100vh - 40px);
        overflow-y: scroll;
        padding-top: 65px;
    }

    a {
      color: ${props => props.theme.color.blue};
      text-decoration: none;
    
      &:hover,
      &:focus {
        color: ${props => props.theme.color.blueDark};
      }
    
      &:focus {
        ${tabFocus}
      }
  }  
`;
