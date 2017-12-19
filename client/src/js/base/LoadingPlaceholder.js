import React from "react";
import { ClipLoader } from "halogenium";

export const LoadingPlaceholder = ({ color = "#3c8786", margin = "220px", message = null, size = "16px" }) => (
    <div className="text-center" style={{marginTop: margin}}>
        {message ? <p>{message}</p> : null}
        <ClipLoader color={color} size={size} />
    </div>
);


