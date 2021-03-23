import {
    ListboxButton as ReachListboxButton,
    ListboxInput as ReachListboxInput,
    ListboxPopover as ReachListboxPopover
} from "@reach/listbox";
import "@reach/listbox/styles.css";
import styled, { keyframes } from "styled-components";
import { border, borderRadius, boxShadow } from "../app/theme";

const focusShadow = "0 0 0 2px rgba(43, 108, 176, 0.5)";

const slideDown = keyframes`
      0% {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
`;

export { ListboxList, ListboxOption } from "@reach/listbox";

export const ListboxButton = styled(ReachListboxButton)`
    border: 1px solid ${props => props.theme.color.greyDark};
    border-radius: ${borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.input};
    cursor: pointer;
    outline: none;
    padding: 8px 10px;
    position: relative;
    width: 100%;

    :focus {
        border-color: ${props => props.theme.color.blue};
        box-shadow: ${focusShadow};
    }
`;

export const ListboxInput = styled(ReachListboxInput)`
    [data-reach-listbox-button][aria-expanded="true"] {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
    }
`;

export const ListboxPopover = styled(ReachListboxPopover)`
    animation: ${slideDown} 100ms ease;
    border: ${border};
    border-radius: ${borderRadius.sm};
    box-shadow: ${boxShadow.md};
    margin-top: -10px;
    padding: 0;
    position: relative;
    z-index: 100;

    :focus-within {
        border-color: ${props => props.theme.color.blue};
        box-shadow: ${focusShadow};
        outline: none;
    }

    > [data-listbox-list] {
        box-shadow: none;
        outline-color: blue;
        animation: ${slideDown} 0.2s ease;
    }

    [data-reach-listbox-option] {
        cursor: pointer;
        padding: 8px 10px;
    }
`;
