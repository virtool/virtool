import React from "react";
import { Alert, Panel } from "react-bootstrap";

const PanelAlert = ({ children }) => (
  <Alert>
    {children}
  </Alert>
);

Panel.Alert = PanelAlert;

export { Panel };
