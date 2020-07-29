import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "../../../base";
import { ReferenceItemInfo } from "./Info";

export const ClonedFrom = ({ id, name }) => (
    <ReferenceItemInfo>
        <h4>
            Cloned from <Link to={`/refs/${id}`}>{name}</Link>
        </h4>
        <p>This reference was cloned from another reference in your Virtool instance.</p>
    </ReferenceItemInfo>
);

export const ImportedFrom = ({ name }) => (
    <ReferenceItemInfo>
        <h4>Imported from {name}</h4>
        <p>This reference was imported from a Virtool reference file.</p>
    </ReferenceItemInfo>
);

export const RemotesFrom = ({ slug }) => (
    <ReferenceItemInfo>
        <h4>
            Remotes from <ExternalLink href={`https://www.github.com/${slug}`}>{slug}</ExternalLink>
        </h4>
        <p>This reference can be kept in sync with a reference published on GitHub.</p>
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
            <h4>Created from scratch.</h4>
            <p>Populate this reference with OTUs to use it.</p>
        </ReferenceItemInfo>
    );
};

ReferenceItemOrigin.propTypes = {
    clonedFrom: PropTypes.object,
    importedFrom: PropTypes.object,
    remotesFrom: PropTypes.object
};
