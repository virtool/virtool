/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportViruses
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Table = require('react-bootstrap/lib/Table');
var Badge = require('react-bootstrap/lib/Badge');
var Label = require('react-bootstrap/lib/Label');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var InputCell = require('virtool/js/components/Base/InputCell.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var ImportViruses = React.createClass({

    render: function () {

        var idField;

        if (dispatcher.user.settings.show_ids) {
            idField = (
                <tr>
                    <th>Database ID</th>
                    <td>{this.props.detail._id}</td>
                </tr>
            );
        }

        var versionField;

        if (dispatcher.user.settings.show_versions) {
            versionField = (
                <tr>
                    <th>Database Version</th>
                    <td>{this.props.detail._version}</td>
                </tr>
            )
        }

        var clusterMembers = this.props.detail.entries.map(function (entry, index) {
            var href = "http://www.ncbi.nlm.nih.gov/protein/" + entry.accession;

            return (
                <tr key={index}>
                    <td><a href={href} target="_blank">{entry.accession}</a></td>
                    <td>{entry.name}</td>
                    <td>{entry.organism}</td>
                </tr>
            )
        });

        var definitions = this.props.detail.definition.map(function (def, index) {
            return <span key={index}><Label>{def}</Label> </span>;
        });

        var taxonomy = {};

        var listGroupStyle = {
            maxHeight: 210,
            overflowY: "auto"
        };

        ["families", "genera"].forEach(function (key) {
            var entries = _.sortBy(_.transform(this.props.detail[key], function (result, count, name) {
                result.push({
                    name: name,
                    count: count
                });
            }, []), 'count').reverse();

            taxonomy[key] = entries.map(function (entry) {
                return (
                    <ListGroupItem key={entry.name}>
                        {entry.name} <Badge>{entry.count}</Badge>
                    </ListGroupItem>
                );
            });
        }, this);

        return (
            <div>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    HMM Detail
                </Modal.Header>

                <Modal.Body>
                    <h5><strong>
                        General
                    </strong></h5>

                    <Table bordered>
                        <tbody>
                            <tr>
                                <th className="col-md-3">Cluster</th>
                                <td className="col-md-9">{this.props.detail.cluster}</td>
                            </tr>

                            {idField}
                            {versionField}

                            <tr>
                                <th>Label</th>
                                <InputCell
                                    _id={this.props.detail._id}
                                    field="label"
                                    value={this.props.detail.label}
                                    collection={dispatcher.collections.hmm}
                                />
                            </tr>

                            <tr>
                                <th>Best Definitions</th>
                                <td>{definitions}</td>
                            </tr>

                            <tr>
                                <th>Length</th>
                                <td>{this.props.detail.length}</td>
                            </tr>

                            <tr>
                                <th>Mean Entropy</th>
                                <td>{this.props.detail.mean_entropy}</td>
                            </tr>

                            <tr>
                                <th>Total Entropy</th>
                                <td>{this.props.detail.total_entropy}</td>
                            </tr>
                        </tbody>
                    </Table>

                    <h5><strong>
                        Cluster Members <Badge>{this.props.detail.entries.length}</Badge>
                    </strong></h5>

                    <Panel style={{height: "408px"}}>
                        <Table className="cluster-table" fill>
                            <thead>
                                <tr>
                                    <th>Accession</th>
                                    <th>Name</th>
                                    <th>Organism</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clusterMembers}
                            </tbody>
                        </Table>
                    </Panel>

                    <Row>
                        <Col md={6}>
                            <h5><strong>
                                Families
                            </strong></h5>
                            <ListGroup style={listGroupStyle}>
                                {taxonomy.families}
                            </ListGroup>
                        </Col>
                        <Col md={6}>
                            <h5><strong>
                                Genera
                            </strong></h5>
                            <ListGroup style={listGroupStyle}>
                                {taxonomy.genera}
                            </ListGroup>
                        </Col>
                    </Row>

                </Modal.Body>
            </div>
        );
    }
});

module.exports = ImportViruses;
