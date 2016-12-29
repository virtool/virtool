/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMDetail
 */

import React from "react";
import { sortBy, transform } from "lodash-es";
import { Row, Col, Modal, Table, Badge, Label, Panel, ListGroup } from "react-bootstrap";
import { InputCell, ListGroupItem } from "virtool/js/components/Base";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
function HMMDetail (props) {

    let idField;

    if (dispatcher.user.settings.show_ids) {
        idField = (
            <tr>
                <th>Database ID</th>
                <td>{props.detail._id}</td>
            </tr>
        );
    }

    let versionField;

    if (dispatcher.user.settings.show_versions) {
        versionField = (
            <tr>
                <th>Database Version</th>
                <td>{this.props.detail._version}</td>
            </tr>
        )
    }

    const clusterMembers = this.props.detail.entries.map((entry, index) => {
        return (
            <tr key={index}>
                <td>
                    <a href={"http://www.ncbi.nlm.nih.gov/protein/" + entry.accession} target="_blank">
                        {entry.accession}
                    </a>
                </td>
                <td>{entry.name}</td>
                <td>{entry.organism}</td>
            </tr>
        )
    });

    const definitions = this.props.detail.definition.map((def, index) => (
        <span key={index}><Label>{def}</Label> </span>
    ));



    let taxonomy = {
        "families": [],
        "genera": []
    };

    ["families", "genera"].forEach((key) => {
        const entries = sortBy(transform(this.props.detail[key], (result, count, name) => {
            result.push({
                name: name,
                count: count
            });
        }, []), "count").reverse();

        taxonomy[key] = entries.map(function (entry) {
            return (
                <ListGroupItem key={entry.name}>
                    {entry.name} <Badge>{entry.count}</Badge>
                </ListGroupItem>
            );
        });
    });

    const listGroupStyle = {
        maxHeight: 210,
        overflowY: "auto"
    };

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
                                collection={dispatcher.db.hmm}
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

                <Panel style={{ height: "408px" }}>
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

HMMDetail.propTypes = {
    detail: React.PropTypes.object
};

export default HMMDetail;
