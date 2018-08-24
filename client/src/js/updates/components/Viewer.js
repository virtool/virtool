import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { LoadingPlaceholder } from "../../base";
import Channels from "./Channels";
import Releases from "./Releases";
import { getSoftwareUpdates } from "../actions";

class SoftwareUpdateViewer extends React.Component {

    componentDidMount () {
        this.props.onGet();
    }

    render () {
        if (this.props.releases === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <div className="settings-container">
                <Row>
                    <Col xs={12}>
                        <h5>
                            <strong>Software Updates</strong>
                        </h5>
                    </Col>
                    <Col xs={12} md={8}>
                        <Releases />
                    </Col>
                    <Col xs={12} md={4}>
                        <Channels />
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    channel: state.settings.data.software_channel,
    releases: state.updates.releases
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);
