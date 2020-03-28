import React from "react";
import { Button } from "./index";

export const SaveButton = props => (
    <Button type="submit" color="blue" icon="save" {...props}>
        {props.altText || "Save"}
    </Button>
);
