import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ExternalLink } from "../../../base";

export const ReferenceItemOrigin = ({ clonedFrom, importedFrom, remotesFrom }) => {
    if (clonedFrom) {
        return (
            <tr>
                <th>Cloned From</th>
                <td>
                    <Link to={`/refs/${clonedFrom.id}`}>{clonedFrom.name}</Link>
                </td>
            </tr>
        );
    }

    if (importedFrom) {
        return (
            <tr>
                <th>Imported From</th>
                <td>{importedFrom.name}</td>
            </tr>
        );
    }

    if (remotesFrom) {
        return (
            <tr>
                <th>Remotes from</th>
                <td>
                    <ExternalLink href={`https://www.github.com/${remotesFrom.slug}`}>{remotesFrom.slug}</ExternalLink>
                </td>
            </tr>
        );
    }

    return (
        <tr>
            <th>Created</th>
            <td>No File</td>
        </tr>
    );
};

ReferenceItemOrigin.propTypes = {
    clonedFrom: PropTypes.object,
    importedFrom: PropTypes.object,
    remotesFrom: PropTypes.object
};
