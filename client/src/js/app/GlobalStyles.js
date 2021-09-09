import { createGlobalStyle, css } from "styled-components";
import { fontWeight } from "./theme";

export const tabFocus = css`
    // WebKit-specific. Other browsers will keep their default outline style.
    // (Initially tried to also force default via \`outline: initial\`,
    // but that seems to erroneously remove the outline in Firefox altogether.)
    outline: 5px auto -webkit-focus-ring-color;
    outline-offset: -2px;
`;

export const GlobalStyles = createGlobalStyle`
    * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    html {
        font-family: -apple-system, system-ui, "Segoe UI Variable", "Segoe UI", system-ui, ui-sans-serif, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: ${props => props.theme.fontSize.md};
        line-height: 1.428571429;
    }
    
    body {
        height: calc(100vh - 40px);
    }
    
    h1 {
        font-size: ${props => props.theme.fontSize.xxl};
    }
    
    h5 {
        font-size: ${props => props.theme.fontSize.md};
        font-weight: ${fontWeight.thick};
        margin: 5px 0 10px;
    }

    a {
        color: ${props => props.theme.color.blueDark};
        text-decoration: none;
    
        &:hover,
        &:focus {
            color: ${props => props.theme.color.blueDarkest};
        }
      
        &:focus {
            ${tabFocus}
        }
    }
    
    code {
        font-family: ${props => props.theme.fontFamily.monospace};
    }  
    
    p {
        margin: 0 0 10px;
    }
  
    label {
        display: inline-block;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    // Reset the box-sizing
    * {
        box-sizing: border-box;
    }
    
    *:before,
    *:after {
        box-sizing: border-box;
    }
    
    // Reset fonts for relevant elements
    input,
    button,
    select,
    textarea {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
    }
`;
