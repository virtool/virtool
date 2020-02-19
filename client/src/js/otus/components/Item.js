import React from "react";
import { get } from "lodash-es";
import styled from "styled-components";
import { connect } from "react-redux";
import { LinkBox, Icon } from "../../base";

const StyledOTUItem = styled(LinkBox)`
    align-items: center;
    display: grid;

    grid-template-columns: 3fr 2fr auto;

    @media (max-width: 990px) {
        align-items: center;
        grid-template-columns: 1fr 100fr auto;
    }
`;

const OTUItemAbbreviation = styled.div`
    @media (max-width: 990px) {
        font-size: 85%;
        margin-left: 5px;
    }
`;

export const OTUItem = ({ abbreviation, id, name, refId, verified }) => (
    <StyledOTUItem key={id} to={`/refs/${refId}/otus/${id}`}>
        <strong>{name}</strong>
        <OTUItemAbbreviation>{abbreviation}</OTUItemAbbreviation>

        {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
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
