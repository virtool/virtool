import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Loader } from "./Loader";

const StyledLoadingPlaceholder = styled.div`
    margin-top: ${props => props.margin || "220px"};
    text-align: center;
`;

/**
 * A component that renders a centered spinner. Used as a placeholder when the rendering of a component depends on an
 * async action such as an API call. An example would be navigating to a sample detail view and showing a spinner while
 * the sample data is retrieved from the server.
 *
 * @param color {string} the hex color of the spinner
 * @param margin {number} the margin to set above the spinner
 * @param message {message} an optional message to show above the spinner
 */
export const LoadingPlaceholder = ({ margin, message }) => (
    <StyledLoadingPlaceholder margin={margin}>
        {message ? <p>{message}</p> : null}
        <Loader />
    </StyledLoadingPlaceholder>
);

LoadingPlaceholder.propTypes = {
    margin: PropTypes.string,
    message: PropTypes.string
};
