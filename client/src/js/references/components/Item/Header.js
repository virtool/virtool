import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../../app/theme";
import { Attribution, Icon, LinkIcon } from "../../../base";

const ReferenceItemDataDescriptor = styled.strong`
    text-transform: capitalize;
`;

const StyledReferenceItemHeader = styled.div`
    padding: 10px 15px;

    h2,
    p {
        align-items: center;
        display: flex;
        justify-content: space-between;
    }

    h2 {
        font-size: ${getFontSize("lg")};
        font-weight: ${getFontWeight("thick")};
        margin: 0 0 4px;
    }

    p {
        font-size: ${getFontSize("md")};

        strong {
            font-weight: ${getFontWeight("thick")};
            text-transform: capitalize;
        }

        i {
            margin-right: 4px;
        }
    }
`;

export const ReferenceItemHeader = ({ createdAt, dataType, id, name, organism, otuCount, userId }) => (
    <StyledReferenceItemHeader>
        <h2>
            <Link to={`/refs/${id}`}>{name}</Link>
            <LinkIcon
                to={{ state: { newReference: true, cloneReference: true, id } }}
                name="clone"
                tip="Clone"
                color="blue"
            />
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
