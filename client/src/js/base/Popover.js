import { useState } from "react";
import { usePopper } from "react-popper";
import styled from "styled-components";
import { borderRadius, boxShadow, getBorder } from "../app/theme";
import { BoxGroup } from "./Box";
import { useClickOutside, useKeyPress } from "./hooks";

export const PopoverBody = styled(BoxGroup)`
    background-color: ${props => props.theme.color.white};
    border: ${getBorder};
    border-radius: ${borderRadius.lg};
    box-shadow: ${boxShadow.lg};
    margin: 0;
    visibility: ${props => (props.show ? "visible" : "hidden")};
    width: 300px;
`;

export const usePopover = () => {
    const [show, setShow] = useState(false);
    const [popperElement, setPopperElement] = useState(null);
    const [referenceElement, setReferenceElement] = useState(null);

    const { styles, attributes } = usePopper(referenceElement, popperElement, { placement: "bottom-end" });

    const onHide = () => {
        setShow(false);
        referenceElement.focus();
    };

    useClickOutside(popperElement, referenceElement, onHide);
    useKeyPress("Escape", onHide);

    return [attributes, show, styles, setPopperElement, setReferenceElement, setShow];
};
