import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { BoxGroupSection, NoneFoundSection, RelativeTime } from "../../../base";
import { DownloadLink } from "../Download Link/DownloadLink";

const Holder = DownloadLink(BoxGroupSection);

export const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <Holder>
                <div>
                    <strong>
                        <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                    </strong>
                    <span>
                        &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                    </span>
                </div>
                {latestBuild.has_json && (
                    <a href={`/download/indexes/${latestBuild.id}`} download>
                        Download Index
                    </a>
                )}
            </Holder>
        );
    }

    return <NoneFoundSection noun="index builds" />;
};

LatestBuild.propTypes = {
    id: PropTypes.string,
    latestBuild: PropTypes.object
};
