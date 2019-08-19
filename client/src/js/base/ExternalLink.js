import React from "react";

export const ExternalLink = ({ children, className, href }) => (
    <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {children}
    </a>
);
