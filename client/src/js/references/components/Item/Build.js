import React from "react";
import { Link } from "react-router-dom";
import { RelativeTime } from "../../../base";
import { ReferenceItemInfo } from "./Info";

export const ReferenceItemBuild = ({ id, latestBuild, progress }) => {
    if (latestBuild && progress === 100) {
        return (
            <ReferenceItemInfo>
                <strong>Latest Build </strong>
                <span>is </span>
                <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                <small>
                    Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </small>
            </ReferenceItemInfo>
        );
    }

    const to = {
        pathname: `/refs/${id}/indexes`,
        state: {
            rebuild: true
        }
    };

    return (
        <ReferenceItemInfo>
            <strong>No index found. </strong>
            <Link to={to}>Build one. </Link>
            <small>You cannot use this reference until you have built an index for it.</small>
        </ReferenceItemInfo>
    );
};
