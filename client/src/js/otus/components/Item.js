import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { get } from "lodash-es";
import styled from "styled-components";
import { connect } from "react-redux";
import { ListGroupItem, Icon } from "../../base";

const OUTItems = styled(ListGroupItem)`
    align-items: end;
    display: grid;

    grid-template-columns: 3fr 2fr auto;

    @media (max-width: 990px) {
        grid-template-columns: 1fr 1111fr auto;
    }
`;

const Abbreviation = styled.div`
    @media (max-width: 990px) {
        font-size: 85%;
        margin-left: 5px;
    }
`;

export const OTUItem = ({ abbreviation, id, name, refId, verified }) => (
    <LinkContainer to={`/refs/${refId}/otus/${id}`} key={id} className="spaced">
        <OUTItems bsStyle={verified ? null : "warning"}>
            <strong>{name}</strong>
            <Abbreviation>{abbreviation}</Abbreviation>

            {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
        </OUTItems>
    </LinkContainer>
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
