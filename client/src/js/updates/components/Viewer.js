import React from "react";
import { filter } from "lodash";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Row, Col, Panel, ListGroup } from "react-bootstrap";

import { getSoftwareUpdates, showInstallModal } from "../actions";
import { updateSetting } from "../../settings/actions";
import { Button, Checkbox, Icon, InputSave } from "../../components/Base";
import { versionComparator } from "../../utils";
import Release from "./Release";
import InstallModal from "./Install";

class SoftwareUpdateViewer extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return (
                <div className="text-center" style={{marginTop: "220px"}}>
                    <ClipLoader color="#3c8786" size="24px" />
                </div>
            );
        }

        const currentVersion = "v1.8.3"; // this.props.updates.current_version;

        const releases = filter(this.props.updates.releases, release => {
            return versionComparator(release.name, currentVersion) === 1;
        });

        let installModal;
        let updateComponent;

        if (releases.length) {
            const releaseComponents = releases.map(release =>
                <Release key={release.name} {...release} />
            );

            installModal = <InstallModal releases={releases} />;

            updateComponent = (
                <Panel>
                    <h5>
                        <strong className="text-warning">
                            <Icon name="info" /> Update{releases.length === 1 ? "": "s"} Available
                        </strong>
                    </h5>

                    <ListGroup>
                        {releaseComponents}
                    </ListGroup>

                    <span className="pull-right">
                        <Button icon="download" bsStyle="primary" onClick={this.props.onShowModal}>
                            Install
                        </Button>
                    </span>
                </Panel>
            );
        } else {
            updateComponent = (
                <Panel>
                    <Icon bsStyle="success" name="checkmark" />
                    <strong className="text-success"> Software is up-to-date</strong>
                </Panel>
            );
        }

        return (
            <div>
                <Row>
                    <Col xs={12}>
                        <h5>
                            <strong>Software Updates</strong>
                        </h5>
                    </Col>
                    <Col xs={12} md={7}>
                        {updateComponent}
                    </Col>
                    <Col xs={12} md={5}>
                        <Panel>
                            <Row>
                                <Col xs={12}>
                                    <InputSave
                                        label="Repository"
                                        initialValue={this.props.softwareRepo}
                                        onSave={(value) => console.log(value)}
                                    />
                                </Col>
                                <Col xs={12}>
                                    <Checkbox label="Ignore pre-releases" checked={true} />
                                </Col>
                            </Row>
                        </Panel>
                    </Col>
                </Row>
                {installModal}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        updates: state.updates.software,
        softwareRepo: state.settings.data.software_repo
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getSoftwareUpdates());
        },

        onUpdateSoftwareRepo: (value) => {
            dispatch(updateSetting("software_repo", value));
        },

        onShowModal: () => {
            dispatch(showInstallModal());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);

export default Container;
