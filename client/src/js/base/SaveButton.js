import React from "react";
import { Button } from "./index";

export const SaveButton = props => (
  <Button type="submit" bsStyle="primary" icon="save" {...props}>
    {props.altText || "Save"}
  </Button>
);
