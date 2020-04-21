import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Button, Icon } from "../../base";
import Release from "./Release";

const ReleasesListHeader = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

export const ReleasesList = ({ releases, onShowInstall }) => {
    const releaseComponents = map(releases, release => <Release key={release.name} {...release} />);

    return (
        <React.Fragment>
            <ReleasesListHeader>
                <strong>
                    <Icon name="arrow-alt-circle-up" /> Update
                    {releases.length === 1 ? "" : "s"} Available
                </strong>
                <Button icon="download" color="blue" onClick={onShowInstall}>
                    Install
                </Button>
            </ReleasesListHeader>
            {releaseComponents}
        </React.Fragment>
    );
};

export default ReleasesList;
