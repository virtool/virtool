import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Label } from "./Label";

const StyledNotFound = styled.div`
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 400px;
    justify-content: center;

    ${Label} {
        font-size: ${props => props.theme.fontSize.xxl};
    }

    strong {
        font-size: ${props => props.theme.fontSize.lg};
        padding-top: 15px;
    }
`;

/**
 * A component used for 404 Not Found errors.
 */
export const NotFound = ({ status = "404", message }) => (
    <StyledNotFound>
        <Label color="red">{status}</Label>
        <strong>{message || "Not found"}</strong>
    </StyledNotFound>
);

NotFound.propTypes = {
    status: PropTypes.number,
    message: PropTypes.string
};
