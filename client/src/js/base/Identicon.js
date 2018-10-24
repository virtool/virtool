import React from "react";
import PropTypes from "prop-types";
import Identiconjs from "identicon.js";

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

  return (
    <img width={size} height={size} src={`data:image/svg+xml;base64,${data}`} />
  );
};

Identicon.propTypes = {
  size: PropTypes.number,
  hash: PropTypes.string.isRequired
};
