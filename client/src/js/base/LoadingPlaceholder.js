import React from "react";
import { ClipLoader } from "halogenium";

/**
 * A component that renders a centered spinner. Used as a placeholder when the rendering of a component depends on an
 * async action such as an API call. An example would be navigating to a sample detail view and showing a spinner while
 * the sample data is retrieved from the server.
 *
 * @param color {string} the hex color of the spinner
 * @param margin {number} the margin to set above the spinner
 * @param message {message} an optional message to show above the spinner
 * @param size {number} the size of the spinner
 */
export const LoadingPlaceholder = ({ color = "#3c8786", margin = "220px", message = null, size = "22px" }) => (
    <div className="text-center" style={{marginTop: margin}}>
        {message ? <p>{message}</p> : null}
        <ClipLoader color={color} size={size} />
    </div>
);
