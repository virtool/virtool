import React from "react";
import { Link } from "react-router-dom";
import { RelativeTime } from "../../../base";
import { ReferenceItemInfo } from "./Info";

export const ReferenceItemBuild = ({ id, latestBuild, progress }) => {
    if (latestBuild && progress === 100) {
        return (
            <ReferenceItemInfo>
                <h4>
                    Latest Build is{" "}
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                </h4>
                <p>
                    Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </p>
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
            <h4>
                No index found. <Link to={to}>Build one. </Link>
            </h4>
            <p>You cannot use this reference until you have built an index for it.</p>
        </ReferenceItemInfo>
    );
};
