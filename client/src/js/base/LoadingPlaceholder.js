import PropTypes from "prop-types";
import React from "react";
import { Loader } from "./Loader";

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
export const LoadingPlaceholder = ({ margin = "220px", message = null, style }) => (
    <div className="text-center" style={{ marginTop: margin, ...style }}>
        {message ? <p>{message}</p> : null}
        <Loader />
    </div>
);

LoadingPlaceholder.propTypes = {
    margin: PropTypes.string,
    message: PropTypes.string,
    style: PropTypes.object
};
