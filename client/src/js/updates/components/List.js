import { map } from "lodash-es";
import styled from "styled-components";
import React from "react";
import { Button, Icon, Box } from "../../base";
import Install from "./Install";
import Release from "./Release";

const ReleasesListHeader = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const ReleasesListGroup = styled(Box)`
    margin: 20px 0 !important;
`;

export const ReleasesList = ({ releases, onShowInstall }) => {
    const releaseComponents = map(releases, release => <Release key={release.name} {...release} />);

    return (
        <React.Fragment>
            <ReleasesListHeader>
                <strong className="text-warning">
                    <Icon name="arrow-alt-circle-up" /> Update
                    {releases.length === 1 ? "" : "s"} Available
                </strong>
                <Button icon="download" bsStyle="primary" onClick={onShowInstall}>
                    Install
                </Button>
            </ReleasesListHeader>

            <ReleasesListGroup>{releaseComponents}</ReleasesListGroup>

            <Install />
        </React.Fragment>
    );
};

export default ReleasesList;
