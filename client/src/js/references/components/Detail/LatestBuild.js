import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { BoxGroupSection, NoneFoundSection, RelativeTime } from "../../../base";
import { DownloadLink } from "./DownloadLink";

const StyledLatestBuild = styled(BoxGroupSection)`
    align-items: center;
    display: flex;

    a {
        margin-left: auto;
    }
`;

export const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <StyledLatestBuild>
                <div>
                    <strong>
                        <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                    </strong>
                    <span>
                        &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                    </span>
                </div>
                {latestBuild.has_json && <DownloadLink id={latestBuild.id} />}
            </StyledLatestBuild>
        );
    }

    return <NoneFoundSection noun="index builds" />;
};

LatestBuild.propTypes = {
    id: PropTypes.string,
    latestBuild: PropTypes.object
};
