import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "../../../base";
import { ReferenceItemInfo } from "./Info";

export const ClonedFrom = ({ id, name }) => (
    <ReferenceItemInfo>
        <strong>Cloned From </strong>
        <Link to={`/refs/${id}`}>{name}</Link>
        <small>This reference was cloned from another reference in your Virtool instance.</small>
    </ReferenceItemInfo>
);

export const ImportedFrom = ({ name }) => (
    <ReferenceItemInfo>
        <strong>Imported From</strong>
        <span>{name}</span>
        <small>This reference was imported from a Virtool reference file.</small>
    </ReferenceItemInfo>
);

export const RemotesFrom = ({ slug }) => (
    <ReferenceItemInfo>
        <span>
            <strong>Remotes from </strong>
            <ExternalLink href={`https://www.github.com/${slug}`}>{slug}</ExternalLink>
        </span>
        <small>This reference can be kept in sync with a reference published on GitHub.</small>
    </ReferenceItemInfo>
);

export const ReferenceItemOrigin = ({ clonedFrom, importedFrom, remotesFrom }) => {
    if (clonedFrom) {
        return <ClonedFrom {...clonedFrom} />;
    }

    if (importedFrom) {
        return <ImportedFrom {...importedFrom} />;
    }

    if (remotesFrom) {
        return <RemotesFrom {...remotesFrom} />;
    }

    return (
        <ReferenceItemInfo>
            <span>
                <strong>Created from scratch.</strong>
            </span>
            <small>Populate this reference with OTUs to use it.</small>
        </ReferenceItemInfo>
    );
};

ReferenceItemOrigin.propTypes = {
    clonedFrom: PropTypes.object,
    importedFrom: PropTypes.object,
    remotesFrom: PropTypes.object
};
