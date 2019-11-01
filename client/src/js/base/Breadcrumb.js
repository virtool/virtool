import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

export const Breadcrumb = styled.ol`
    padding: 3px 0;
    margin-bottom: 20px;
    list-styled: none;
    border-radius: 0;

    li {
        list-styled: none;
        display: inline-block;
        color: #777777;

        :not(:first-child) {
            ::before {
                content: "/";
                padding: 0 5px;
                color: #ccc;
            }
        }
    }
`;

export const BreadcrumbItem = ({ children, to }) => {
    if (to) {
        return (
            <li>
                <Link to={to}>{children}</Link>
            </li>
        );
    }

    return <li>{children}</li>;
};
