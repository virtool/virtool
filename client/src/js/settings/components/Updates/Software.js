/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SoftwareUpdates
 */

import React from "react";
import Moment from "moment";
import { Row, Col, Alert, Panel, FormGroup, FormControl, InputGroup, Label } from "react-bootstrap";
import { Icon, Flex, FlexItem, Button, ListGroupItem, AutoProgressBar } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

import SoftwareNotification from "./SoftwareNotification";

const makeOrderable = (version) => parseInt(version.replace(/\D/g, "").replace(".", ""));

const SoftwareRelease = (props) => {

    let installedLabel;

    if (props.installed) {
        installedLabel = <Label bsStyle="primary">Installed</Label>
    }

    let latestLabel;

    if (props.latest) {
        latestLabel = <Label bsStyle="success">Latest</Label>
    }

    return (
        <ListGroupItem>
            <Row>
                <Col md={2}>{props.name}</Col>
                <Col md={2}>{byteSize(props.size)}</Col>
                <Col md={3}>Released on {Moment(props.published_at).format("YY-MM-DD")}</Col>
                <Col md={3}>
                    <a className="btn btn-default btn-xs" target="_blank" href={props.html_url}>
                        <Icon name="github" /> GitHub
                    </a>
                </Col>
                <Col md={2}>
                    <span className="pull-right">
                        {installedLabel} {latestLabel}
                    </span>
                </Col>
            </Row>
        </ListGroupItem>
    );
};

SoftwareRelease.propTypes = {
    name: React.PropTypes.string,
    size: React.PropTypes.number,
    html_url: React.PropTypes.string,
    prerelease: React.PropTypes.bool,
    published_at: React.PropTypes.string,
    installed: React.PropTypes.bool,
    latest: React.PropTypes.bool

};

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
export default class SoftwareUpdates extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            repo: this.props.settings.software_repo,
            refreshing: false
        };
    }

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object,
        updates: React.PropTypes.object
    };

    handleRepoChange = (event) => {
        if (event.target.value.length > 15) {
            this.setState({repo: event.target.value.replace("www.github.com/", "")});
        } else {
            this.setState({repo: ""})
        }
    };

    saveRepo = (event) => {
        event.preventDefault();
        this.props.set("software_repo", this.state.repo);
    };

    refreshReleases = () => {
        this.setState({refreshing: true}, () =>
            dispatcher.db.updates.request("refresh_software_releases", {})
                .success(() => this.setState({refreshing: false}))
        );
    };

    render () {

        const version = this.props.settings.server_version.split("-")[0];

        const releases = this.props.updates.branch()
            .find({"type": "software"})
            .simplesort("published_at")
            .data()
            .reverse();

        let notification;
        let releaseComponents;

        if (releases.length > 0) {

            let installDocument = this.props.updates.branch().find({"_id": "software_install"}, true).data();

            installDocument = installDocument.length === 1 ? installDocument[0]: null;

            if (version === releases[0].name && !installDocument) {
                notification = (
                    <Alert bsStyle="info">
                        <Icon name="checkmark" /> Running latest version
                    </Alert>
                )
            }

            if (makeOrderable(version) < makeOrderable(releases[0].name)) {
                notification = (
                    <SoftwareNotification
                        latestRelease={releases[0]}
                        installDocument={installDocument}
                    />
                );
            }

            releaseComponents = releases.map((release, index) => {
                return <SoftwareRelease
                    key={release._id}
                    latest={index === 0}
                    installed={version.split("-")[0] === release.name}
                    {...release}
                />
            });

        } else {
            releaseComponents = (
                <ListGroupItem bsStyle="danger" className="text-center">
                    <h5><Icon name="warning" /> <strong>No releases found</strong></h5>
                    <p><small>Ensure the target repository exists and has at least one published release.</small></p>
                </ListGroupItem>
            );
        }

        return (
            <div>
                <h5><strong>Software Update</strong></h5>
                <Panel>
                    {notification}

                    <div className="panel panel-default">
                        <div className="panel-heading">
                            <span>Releases</span>
                            <Icon name="reset" bsStyle="primary" onClick={this.refreshReleases} pullRight />
                        </div>
                        <AutoProgressBar active={this.state.refreshing} affixed />
                        <div className="list-group">
                            {releaseComponents}
                        </div>
                    </div>

                    <form onSubmit={this.saveRepo}>
                        <Flex style={{marginBottom: "15px"}}>
                            <FlexItem grow={1}>
                                <FormGroup className="no-margin">
                                    <InputGroup>
                                        <InputGroup.Addon>
                                            Repository
                                        </InputGroup.Addon>
                                        <FormControl
                                            type="text"
                                            value={`www.github.com/${this.state.repo}`}
                                            spellCheck={false}
                                            onChange={this.handleRepoChange}
                                        />
                                    </InputGroup>
                                </FormGroup>
                            </FlexItem>

                            <Button icon="floppy" bsStyle="primary" type="submit" style={{marginLeft: "-1px"}} />
                        </Flex>
                    </form>
                </Panel>
            </div>
        )
    }
}
