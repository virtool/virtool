import React from "react";
import { get } from "lodash-es";
import styled from "styled-components";
import { connect } from "react-redux";
import { getFontSize, getFontWeight } from "../../app/theme";
import { LinkBox, Icon } from "../../base";

const OTUItemAbbreviation = styled.span`
    margin-left: auto;
`;

const OTUItemName = styled.strong`
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};
`;

const StyledOTUItem = styled(LinkBox)`
    align-items: center;
    display: flex;
`;

export const OTUItem = ({ abbreviation, id, name, refId, verified }) => (
    <StyledOTUItem key={id} to={`/refs/${refId}/otus/${id}`}>
        <OTUItemName>{name}</OTUItemName>
        <OTUItemAbbreviation>{abbreviation}</OTUItemAbbreviation>
        {verified ? null : <Icon name="tag" tip="This OTU is unverified" />}
    </StyledOTUItem>
);

export const mapStateToProps = (state, props) => {
    const { abbreviation, id, name, verified } = get(state, ["otus", "documents", props.index]);
    return {
        abbreviation,
        id,
        name,
        verified,
        refId: state.references.detail.id
    };
};

export default connect(mapStateToProps)(OTUItem);
