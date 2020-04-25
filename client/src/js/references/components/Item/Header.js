import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Attribution, Icon } from "../../../base";

const ReferenceItemDataDescriptor = styled.strong`
    text-transform: capitalize;
`;

const ReferenceItemHeaderLink = styled(Link)`
    font-weight: bold;
`;

const StyledReferenceItemHeader = styled.div`
    padding: 10px 15px;

    h2,
    p {
        align-items: center;
        display: flex;
        justify-content: space-between;
    }

    p > strong {
        text-transform: capitalize;
    }

    h2 {
        font-size: 16px;
        margin: 0 0 4px;
    }

    p {
        font-size: 14px;

        i {
            margin-right: 4px;
        }
    }
`;

export const ReferenceItemHeader = ({ createdAt, dataType, id, name, organism, otuCount, userId }) => (
    <StyledReferenceItemHeader>
        <h2>
            <ReferenceItemHeaderLink to={`/refs/${id}`}>{name}</ReferenceItemHeaderLink>
            <Link to={{ state: { newReference: true, cloneReference: true, id } }}>
                <Icon name="clone" tip="Clone" />
            </Link>
        </h2>
        <p>
            <span>
                <Icon name={dataType === "genome" ? "dna" : "barcode"} />
                <ReferenceItemDataDescriptor>
                    {organism || "unknown"} {dataType || "genome"}s
                </ReferenceItemDataDescriptor>
                <span> organized into {otuCount} OTUs</span>
            </span>
            <Attribution time={createdAt} user={userId} />
        </p>
    </StyledReferenceItemHeader>
);

ReferenceItemHeader.propTypes = {
    createdAt: PropTypes.string.isRequired,
    dataType: PropTypes.string,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    organism: PropTypes.string,
    otuCount: PropTypes.number,
    userId: PropTypes.string.isRequired
};
