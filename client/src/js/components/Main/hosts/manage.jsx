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
var HostsTable = require('./Manage/Table.jsx');
var FilesTable = require('./Manage/Files.jsx');

/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
var ManageHosts = React.createClass({

    render: function () {

        var canAddHost = dispatcher.user.permissions.add_host;

        var alert;

        if (_.filter(dispatcher.collections.hosts.documents, {added: true}).length === 0) {
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
                    <FilesTable
                        collection={dispatcher.collections.files}
                        hostsCollection={dispatcher.collections.hosts}
                    />
                </Col>
            );
        }

        return (
            <div>
                {alert}
                <Row>

                    <Col md={canAddHost ? 5: 12}>
                        <HostsTable
                            collection={dispatcher.collections.hosts}
                        />
                    </Col>
                    {filesTable}
                </Row>
            </div>
        );
    }
});

module.exports = ManageHosts;