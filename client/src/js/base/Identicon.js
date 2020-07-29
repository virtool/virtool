import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import Identiconjs from "identicon.js";

const StyledIdenticon = styled.img`
    border-radius: ${props => props.size / 2}px;
    box-shadow: ${props => props.theme.boxShadow.sm};
    height: ${props => props.size}px;
    width: ${props => props.size}px;
`;

/**
 * Generates an identicon SVG from a user's identicon hash. Used for visually identifying users.
 *
 * @param size {number} the size of SVG to render
 * @param hash {string} the users identicon hash
 */
export const Identicon = ({ hash, size = 64 }) => {
    const data = new Identiconjs(hash, {
        background: [226, 232, 240],
        size,
        format: "svg"
    });

    return <StyledIdenticon src={`data:image/svg+xml;base64,${data}`} size={size} />;
};

Identicon.propTypes = {
    size: PropTypes.number,
    hash: PropTypes.string.isRequired
};
