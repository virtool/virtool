import React from "react";
import { Button } from "../../../base";

const RemoveReference = ({ id }) => (
    <Button bsStyle="danger" onClick={() => console.log("remove", id)} pullRight>
        Delete
    </Button>
);

export default RemoveReference;
