import React from "react";
import styled from "styled-components";

export const UnstyledExternalLink = ({ children, className, href }) => (
    <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {children}
    </a>
);

export const ExternalLink = styled(UnstyledExternalLink)``;
