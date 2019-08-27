import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { Label } from "./Label";

const StyledNotFound = styled.div`
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 400px;
    justify-content: center;

    ${Label} {
        font-size: 36px;
    }

    strong {
        font-size: 16px;
        padding-top: 15px;
    }
`;

/**
 * A component used for 404 Not Found errors.
 */
export const NotFound = ({ status = "404", message }) => (
    <StyledNotFound>
        <Label bsStyle="danger">{status}</Label>
        <strong>{message || "Not found"}</strong>
    </StyledNotFound>
);

NotFound.propTypes = {
    status: PropTypes.number,
    message: PropTypes.string
};
