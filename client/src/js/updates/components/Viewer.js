import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { LoadingPlaceholder, NarrowContainer } from "../../base";
import { getSoftwareUpdates } from "../actions";
import Channels from "./Channels";
import Releases from "./Releases";

const StyledSoftwareUpdateViewer = styled(NarrowContainer)`
    display: flex;
    align-items: flex-start;
`;

export class SoftwareUpdateViewer extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        if (this.props.loading) {
            return <LoadingPlaceholder />;
        }

        return (
            <StyledSoftwareUpdateViewer>
                <Releases />
                <Channels />
            </StyledSoftwareUpdateViewer>
        );
    }
}

export const mapStateToProps = state => ({
    loading: state.updates.releases === null
});

export const mapDispatchToProps = dispatch => ({
    onGet: () => {
        dispatch(getSoftwareUpdates());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);
