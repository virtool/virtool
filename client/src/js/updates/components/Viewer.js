import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { LoadingPlaceholder } from "../../base";
import { getSoftwareUpdates } from "../actions";
import Channels from "./Channels";
import Releases from "./Releases";

const StyledChannels = styled.div`
    grid-row: 1 / 3;
`;

const ReleaseChannel = styled.div`
    display: grid;

    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-gap: 13px;

    div {
        grid-row: 1 / -1;
    }
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
                <h5>
                    <strong>Software Updates</strong>
                </h5>

                <ReleaseChannel>
                    <Releases />

                    <StyledChannels>
                        <Channels />
                    </StyledChannels>
                </ReleaseChannel>
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
