import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Alert, Box, Icon } from "../../../base";
import { getMatches } from "../../selectors";

import AODPDetail from "./Detail";
import { AODPList } from "./List";
import AODPOverview from "./Overview";
import AODPToolBar from "./Toolbar";

const AODPPanes = styled.div`
    margin-top: 10px;
    display: grid;
    grid-gap: 10px;
    grid-template-columns: 300px 1fr;
`;

const AODPNoneFound = styled(Box)`
    align-items: center;
    display: flex;
    height: 220px;
    justify-content: center;
    margin-top: 10px;

    span {
        margin-left: 5px;
    }
`;

export const AODPViewer = ({ show }) => {
    let panes;

    if (show) {
        panes = (
            <AODPPanes>
                <AODPList />
                <AODPDetail />
            </AODPPanes>
        );
    } else {
        panes = (
            <AODPNoneFound>
                <Icon name="filter" />
                <span>No results match filters</span>
            </AODPNoneFound>
        );
    }

    return (
        <div>
            <Alert color="orange" level>
                <Icon name="exclamation-circle" />
                <span>
                    <strong>This is preview report format for AODP.</strong> It is likely to change.
                </span>
            </Alert>
            <AODPOverview />
            <AODPToolBar />
            {panes}
        </div>
    );
};

export const mapStateToProps = state => ({
    show: !!getMatches(state).length
});

export default connect(mapStateToProps)(AODPViewer);
