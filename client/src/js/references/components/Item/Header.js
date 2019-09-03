import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Icon, Panel, RelativeTime } from "../../../base";

const ReferenceItemHeaderLink = styled(Link)`
    font-weight: bold;
`;

const ReferenceItemHeaderTitle = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

export const ReferenceItemHeader = ({ createdAt, id, name, userId }) => (
    <Panel.Heading>
        <ReferenceItemHeaderTitle>
            <ReferenceItemHeaderLink to={`/refs/${id}`}>{name}</ReferenceItemHeaderLink>
            <Link to={{ state: { newReference: true, cloneReference: true, id } }}>
                <Icon name="clone" tip="Clone" />
            </Link>
        </ReferenceItemHeaderTitle>
        <small>
            Created <RelativeTime time={createdAt} /> by {userId}
        </small>
    </Panel.Heading>
);

ReferenceItemHeader.propTypes = {
    createdAt: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired
};
