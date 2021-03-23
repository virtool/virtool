import React from "react";
import styled from "styled-components";
import { fontWeight } from "../../../../app/theme";

const StyledSequenceTarget = styled.div`
    padding: 5px;

    h5 {
        font-weight: ${fontWeight.thick};
        margin: 0 0 3px 0;
    }

    p {
        font-weight: ${fontWeight.normal};
        margin: 0;
    }
`;

export const SequenceTarget = ({ name, description }) => (
    <StyledSequenceTarget>
        <h5>{name}</h5>
        <p>{description || <em>No Description</em>}</p>
    </StyledSequenceTarget>
);
