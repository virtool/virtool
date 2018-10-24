import React from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";

export const RemoveBanner = ({ message, buttonText, onClick }) => (
  <Alert bsStyle="danger">
    <div style={{ textAlign: "right" }}>
      <span style={{ float: "left", marginTop: "7px" }}>{message}</span>
      <Button bsStyle="danger" onClick={onClick}>
        {buttonText}
      </Button>
    </div>
  </Alert>
);
