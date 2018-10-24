import React from "react";
import PropTypes from "prop-types";
import { Jumbotron } from "react-bootstrap";

/**
 * A component used for 404 Not Found errors.
 */
export const NotFound = ({ status, message }) => (
  <Jumbotron className="not-found">
    <h1 style={{ margin: "0 0 10px 0" }}>
      <span className="label label-danger" style={{ padding: "10px 25px" }}>
        {status || 404}
      </span>
      <small style={{ color: "black", paddingLeft: "15px" }}>
        <strong>{message || "Not found"}</strong>
      </small>
    </h1>
  </Jumbotron>
);

NotFound.propTypes = {
  status: PropTypes.number,
  message: PropTypes.string
};
