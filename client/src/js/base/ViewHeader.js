import { isUndefined } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import Helmet from "react-helmet";
import styled from "styled-components";
import { Attribution, Badge, Flex, FlexItem } from "./index";

const StyledViewHeader = styled.h2`
    font-size: 26px;
    margin-bottom: 20px;

    ${Attribution} {
        color: ${props => props.theme.color.greyDark};
        font-size: 14px;
    }

    i.fas {
        font-size: 20px;
    }
`;

/**
 * A reusable header shown at the top of views that browse through paged items. For example, the OTU browser
 * contains a ``<ViewHeader />`` component with the title 'OTUs', and optional children.
 *
 */
export const ViewHeader = ({ title, totalCount, children }) => (
    <StyledViewHeader>
        <Helmet title={title} />
        {isUndefined(totalCount) ? null : (
            <Flex alignItems="flex-end">
                <FlexItem grow={0} shrink={0}>
                    <strong>{title}</strong> <Badge>{totalCount}</Badge>
                </FlexItem>
            </Flex>
        )}
        {children}
    </StyledViewHeader>
);

ViewHeader.propTypes = {
    title: PropTypes.string.isRequired,
    totalCount: PropTypes.number,
    children: PropTypes.node
};

export const SubviewHeader = styled.div`
    margin-bottom: 15px;
`;

export const SubviewHeaderTitle = styled.div`
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 0;
`;

export const SubviewHeaderAttribution = styled.span`
    color: #777777;
    font-size: 12px;
    font-weight: bold;
`;
