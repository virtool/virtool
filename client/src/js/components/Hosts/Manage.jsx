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

'use strict';

var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

var HostsTable = require('./Manage/Table.jsx');
var FilesTable = require('./Manage/Files.jsx');
var AddModal = require('./Manage/Add.jsx');
var HostDetail = require('./Manage/Detail.jsx');


/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
var ManageHosts = React.createClass({

    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    render: function () {

        var canAddHost = dispatcher.user.permissions.add_host;

        var alert;

        if (dispatcher.db.hosts.count({added: true}) === 0) {
            alert = (
                <Alert>
                    <Icon name='info' /> A host genome must be added to Virtool before samples can be created and analyzed.
                </Alert>
            );
        }

        var filesTable;

        if (canAddHost) {
            filesTable = (
                <Col md={7}>
                    <FilesTable route={this.props.route} />
                </Col>
            );
        }

        var addTarget;

        if (this.props.route.extra[0] === 'add') {
            addTarget = dispatcher.db.files.findOne({_id: this.props.route.extra[1]});
        }

        var detailTarget;

        if (this.props.route.extra[0] === 'detail') {
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
                    dialogClassName='modal-md'
                />
            </div>
        );
    }
});

module.exports = ManageHosts;