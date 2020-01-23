import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { BoxGroupSection, NoneFoundSection, RelativeTime } from "../../../base";

export const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <BoxGroupSection>
                <strong>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                </strong>
                <span>
                    &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </span>
            </BoxGroupSection>
        );
    }

    return <NoneFoundSection noun="index builds" />;
};

LatestBuild.propTypes = {
    id: PropTypes.string,
    latestBuild: PropTypes.object
};
