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
var Panel = require('react-bootstrap/lib/Panel');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var HostsTable = require('./Manage/Table.jsx');
var FilesTable = require('./Manage/Files.jsx');

/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
var ManageHosts = React.createClass({

    render: function () {

        var canAddHost = dispatcher.user.permissions.add_host;

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
            <Row>
                <Col md={canAddHost ? 5: 12}>
                    <HostsTable
                        collection={dispatcher.collections.hosts}
                    />
                </Col>
                {filesTable}
            </Row>
        );
    }
});

module.exports = ManageHosts;