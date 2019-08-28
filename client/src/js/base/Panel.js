import React from "react";
import { Panel } from "react-bootstrap";
import { Alert } from "./Alert";

const PanelAlert = ({ children }) => <Alert>{children}</Alert>;

Panel.Alert = PanelAlert;

export { Panel };
