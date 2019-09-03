import { Modal as BsModal } from "react-bootstrap";
import styled from "styled-components";
import { Alert } from "./Alert";

export const Modal = styled(BsModal)`
    ${Alert} {
        border-left: none;
        border-radius: 0;
        border-right: none;
        margin: -1px 0 0;
    }
`;
