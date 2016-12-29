/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ManageHosts
 */

import React from "react";
import { Row, Col, Alert } from "react-bootstrap";
import { Icon, DetailModal } from "virtool/js/components/Base";

import HostsTable from "./Table";
import FilesTable from "./Files";
import AddModal from "./Add";
import HostDetail from "./Detail";

/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
export default class ManageHosts extends React.Component {

    static propTypes = {
        route: React.PropTypes.object.isRequired
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        const canAddHost = dispatcher.user.permissions.add_host;

        let alert;

        if (dispatcher.db.hosts.count({added: true}) === 0) {
            alert = (
                <Alert>
                    <Icon name="info" />
                    <span> A host genome must be added to Virtool before samples can be created and analyzed.</span>
                </Alert>
            );
        }

        let filesTable;

        if (canAddHost) {
            filesTable = (
                <Col md={7}>
                    <FilesTable route={this.props.route} />
                </Col>
            );
        }

        let addTarget;

        if (this.props.route.extra[0] === "add") {
            addTarget = dispatcher.db.files.findOne({_id: this.props.route.extra[1]});
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.hosts.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                {alert}

                <Row>
                    <Col md={canAddHost ? 5: 12}>
                        <HostsTable route={this.props.route} />
                    </Col>
                    {filesTable}
                </Row>

                <AddModal
                    onHide={this.hideModal}
                    show={Boolean(addTarget)}
                    target={addTarget}
                />

                <DetailModal
                    target={detailTarget}
                    contentComponent={HostDetail}
                    collection={dispatcher.db.hosts}
                    onHide={this.hideModal}
                    dialogClassName="modal-md"
                />
            </div>
        );
    }
}
