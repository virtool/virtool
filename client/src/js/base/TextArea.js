import React from "react";
import styled from "styled-components";
import { Input } from "./Input";

const StyledTextArea = styled(Input)`
    height: 220px;
    resize: vertical;
    overflow-y: scroll;
`;

export const TextArea = props => <StyledTextArea as="textarea" {...props} />;
