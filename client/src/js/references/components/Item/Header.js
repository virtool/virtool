import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { BoxGroupHeader, Icon, RelativeTime } from "../../../base";

const ReferenceItemHeaderLink = styled(Link)`
    font-weight: bold;
`;

export const ReferenceItemHeader = ({ createdAt, id, name, userId }) => (
    <BoxGroupHeader>
        <h2>
            <ReferenceItemHeaderLink to={`/refs/${id}`}>{name}</ReferenceItemHeaderLink>
            <Link to={{ state: { newReference: true, cloneReference: true, id } }}>
                <Icon name="clone" tip="Clone" />
            </Link>
        </h2>
        <p>
            Created <RelativeTime time={createdAt} /> by {userId}
        </p>
    </BoxGroupHeader>
);

ReferenceItemHeader.propTypes = {
    createdAt: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired
};
