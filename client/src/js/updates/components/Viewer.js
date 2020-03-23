import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { LoadingPlaceholder } from "../../base";
import { getSoftwareUpdates } from "../actions";
import Channels from "./Channels";
import Releases from "./Releases";

const SoftwareUpdateViewerBody = styled.div`
    display: flex;
    align-items: flex-start;
`;

export class SoftwareUpdateViewer extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        if (this.props.releases === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <div className="settings-container">
                <SoftwareUpdateViewerBody>
                    <Releases />
                    <Channels />
                </SoftwareUpdateViewerBody>
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    channel: state.settings.data.software_channel,
    releases: state.updates.releases
});

export const mapDispatchToProps = dispatch => ({
    onGet: () => {
        dispatch(getSoftwareUpdates());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);
