import React from "react";
import { Link } from "react-router-dom";
import { RelativeTime } from "../../../base";

export const ReferenceItemBuild = ({ id, latestBuild, progress }) => {
    if (latestBuild && progress === 100) {
        return (
            <tr>
                <th>Latest Build</th>
                <td>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                        Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr>
            <th>Latest Build</th>
            <td>No Build Found</td>
        </tr>
    );
};
