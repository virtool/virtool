import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import Identiconjs from "identicon.js";

const StyledIdenticon = styled.img`
    border-radius: ${props => props.size / 2}px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    height: ${props => props.size}px;
    width: ${props => props.size}px;
`;

/**
 * Generates an identicon SVG from a user's identicon hash. Used for visually identifying users.
 *
 * @param size {number} the size of SVG to render
 * @param hash {string} the users identicon hash
 */
export const Identicon = ({ size = 64, hash }) => {
    const data = new Identiconjs(hash, {
        size,
        format: "svg"
    });

    return <StyledIdenticon src={`data:image/svg+xml;base64,${data}`} size={size} />;
};

Identicon.propTypes = {
    size: PropTypes.number,
    hash: PropTypes.string.isRequired
};
