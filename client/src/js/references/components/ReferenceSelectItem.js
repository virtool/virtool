import React from "react";
import styled from "styled-components";
import { Badge, ListGroupItem, RelativeTime } from "../../base";

const NameDateBadge = styled(ListGroupItem)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    strong {
        margin-left: 8px;
    }
`;

const DateBadge = styled.div`
    display: flex;
    flex-direction: row;
    margin-right: 15px;
    align-items: center;

    ${Badge} {
        margin-left: 65px;
        color: white;
    }
    span {
        font-size: 10px;
        color: grey;
    }
`;

export const ReferenceSelectItem = ({ reference, onClick }) => {
    return (
        <NameDateBadge onClick={onClick}>
            <strong>{reference.name}</strong>
            <DateBadge>
                <span>
                    Created <RelativeTime time={reference.created_at} /> by {reference.user.id}
                </span>
                <Badge>{reference.otu_count}</Badge>
            </DateBadge>
        </NameDateBadge>
    );
};
