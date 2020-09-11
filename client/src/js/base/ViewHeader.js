import PropTypes from "prop-types";
import React from "react";
import { Helmet } from "react-helmet";
import styled from "styled-components";
import { getFontWeight } from "../app/theme";
import { Attribution, Badge } from "./index";

export const ViewHeaderAttribution = styled(Attribution)`
    color: ${props => props.theme.color.darkgrey};
    font-size: ${props => props.theme.fontSize.md};
    margin-top: 5px;
`;

export const ViewHeaderIcons = styled.div`
    align-items: center;
    display: flex;
    font-size: ${props => props.theme.fontSize.lg};
    margin-left: auto;

    > *:not(:last-child) {
        margin-right: 5px;
    }
`;

export const ViewHeaderTitle = styled.h1`
    align-items: center;
    display: flex;
    font-weight: bold;
    margin: 0;

    ${Badge} {
        font-size: ${props => props.theme.fontSize.md};
        margin-left: 7px;
        padding: 5px 7px;
    }
`;

const StyledViewHeader = styled.div`
    display: block;
    margin: 10px 0 20px;
`;

export const ViewHeader = ({ className, title, children }) => (
    <StyledViewHeader className={className}>
        <Helmet>
            <title>{title}</title>
        </Helmet>
        {children}
    </StyledViewHeader>
);

ViewHeader.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    title: PropTypes.string.isRequired,
    totalCount: PropTypes.number
};

export const SubviewHeader = styled.div`
    margin-bottom: 15px;
`;

export const SubviewHeaderTitle = styled.div`
    font-size: ${props => props.theme.fontSize.xl};
    font-weight: bold;
    margin-bottom: 0;
`;

export const SubviewHeaderAttribution = styled.span`
    color: ${props => props.theme.color.greyDarkest};
    font-size: ${props => props.theme.fontSize.md};
    font-weight: ${getFontWeight("thick")};
`;
