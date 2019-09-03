import React from "react";
import styled from "styled-components";
import { Panel as BsPanel } from "react-bootstrap";
import { Alert } from "./Alert";
import { Table } from "./Table";

const Panel = styled(BsPanel)`
    ${Table} {
        border: none;
        margin: 0;
    }
`;

const PanelAlert = ({ children }) => <Alert>{children}</Alert>;

Panel.Alert = PanelAlert;

export { Panel };
