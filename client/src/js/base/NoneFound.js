import React from "react";
import styled from "styled-components";
import { Box, BoxGroupSection } from "./Box";
import { Icon } from "./Icon";

/**
 * A ListGroupItem component with a 'none found'-type message. Used in ListGroups when no data is available to populate
 * the list. For example, when no sample have been created.
 *
 * @param noun {string} the name of the items of which none were found (eg. samples)
 * @param noListGroup {boolean} don't include a ListGroup in the returned element
 */
export const NoneFound = ({ noun, noListGroup, style }) => {
    const item = (
        <Box className="text-center">
            <Icon name="info-circle" /> No {noun} found
        </Box>
    );

    if (noListGroup) {
        return item;
    }

    return <Box style={style}>{item}</Box>;
};

const StyledNoneFoundBox = styled(Box)`
    align-items: center;
    display: flex;
    min-height: 30px;
`;

export const NoneFoundBox = ({ noun }) => (
    <StyledNoneFoundBox>
        <Icon name="info-circle" /> No {noun} found
    </StyledNoneFoundBox>
);

const StyledNoneFoundSection = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
    min-height: 52px;
    justify-content: center;

    i.fas {
        margin-right: 5px;
    }
`;

export const NoneFoundSection = ({ noun }) => (
    <StyledNoneFoundSection>
        <Icon name="info-circle" /> No {noun} found
    </StyledNoneFoundSection>
);
