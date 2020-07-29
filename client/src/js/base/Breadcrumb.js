import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { getFontWeight } from "../app/theme";

export const Breadcrumb = styled.ol`
    padding: 3px 0;
    margin-bottom: 20px;
    list-style: none;
    border-radius: 0;

    li {
        list-style: none;
        display: inline-block;
        color: ${props => props.theme.color.greyDark};

        :not(:first-child) {
            ::before {
                color: ${props => props.theme.color.grey};
                content: "/";
                font-weight: ${getFontWeight("thick")};
                padding: 0 5px;
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
