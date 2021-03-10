import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { BoxGroupSection, Icon, NoneFoundSection, RelativeTime } from "../../../base";
import styled from "styled-components";

const StyledLatestBuild = styled(BoxGroupSection)`
    align-items: center;
    display: flex;

    a {
        margin-left: auto;
    }
`;

export const LatestBuild = ({ id, latestBuild }) => {
    console.log("LatestBuild = ", latestBuild);
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
                {
                    //Uncomment line below once
                    /*latestBuild.has_json && */ <a href={`/download/indexes/:${latestBuild.id}`} download>
                        Download Index
                    </a>
                }
            </StyledLatestBuild>
        );
    }

    return <NoneFoundSection noun="index builds" />;
};

LatestBuild.propTypes = {
    id: PropTypes.string,
    latestBuild: PropTypes.object
};
