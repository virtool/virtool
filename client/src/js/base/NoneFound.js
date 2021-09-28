import React from "react";
import PropTypes from "prop-types";
import styled, { css } from "styled-components";
import { Box, BoxGroupSection } from "./Box";
import { Icon } from "./Icon";

const noneFoundStyle = css`
    align-items: center;
    display: flex;
    justify-content: center;

    i.fas {
        margin-right: 5px;
    }
`;

/**
 * A ListGroupItem component with a 'none found'-type message. Used in ListGroups when no data is available to populate
 * the list. For example, when no sample have been created.
 *
 * @param noun {string} the name of the items of which none were found (eg. samples)
 * @param noListGroup {boolean} don't include a ListGroup in the returned element
 */
const StyledNoneFound = styled.div`
    ${noneFoundStyle}

    i.fas {
        margin-right: 5px;
    }
`;

export const NoneFound = ({ noun }) => {
    return (
        <StyledNoneFound>
            <Icon name="info-circle" /> No {noun} found
        </StyledNoneFound>
    );
};

NoneFound.propTypes = {
    noun: PropTypes.string.isRequired
};

const StyledNoneFoundBox = styled(Box)`
    ${noneFoundStyle}
    min-height: 30px;
`;

export const NoneFoundBox = ({ noun, children }) => (
    <StyledNoneFoundBox as={Box}>
        <Icon name="info-circle" /> No {noun} found. &nbsp; {children}
    </StyledNoneFoundBox>
);

NoneFoundBox.propTypes = {
    noun: PropTypes.string.isRequired
};

const StyledNoneFoundSection = styled(BoxGroupSection)`
    ${noneFoundStyle}
    justify-content: center;
`;

export const NoneFoundSection = ({ children, noun }) => {
    let childrenContainer;

    if (children) {
        childrenContainer = <span>. {children}.</span>;
    }

    return (
        <StyledNoneFoundSection>
            <Icon name="info-circle" /> No {noun} found{childrenContainer}
        </StyledNoneFoundSection>
    );
};

NoneFoundSection.propTypes = {
    children: PropTypes.node,
    noun: PropTypes.string.isRequired
};
