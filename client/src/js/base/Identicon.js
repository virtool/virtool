import React from "react";
import Identiconjs from "identicon.js";

export const Identicon = ({ size = 64, hash }) => {

    const data = new Identiconjs(hash, {
        size,
        format: "svg"
    });

    return <img width={size} height={size} src={`data:image/svg+xml;base64,${data}`} />;

};
