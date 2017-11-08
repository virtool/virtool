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
import { ClipLoader } from "halogenium";
import { connect } from "react-redux";
import { sortBy, transform } from "lodash";
import { Row, Col, Table, Badge, Label, Panel, ListGroup } from "react-bootstrap";

import { ListGroupItem } from "../../base";
import { getHmm } from "../actions";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
class HMMDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.hmmId);
    }

    render () {

        if (this.props.detail === null) {
            return(
                <div className="text-center" style={{paddingTop: "130px"}}>
                    <ClipLoader color="#3c8786" />
                </div>
            );
        }

        let idField;

        if (this.props.showIds) {
            idField = (
                <tr>
                    <th>Database ID</th>
                    <td>{this.props.detail.id}</td>
                </tr>
            );
        }

        const clusterMembers = this.props.detail.entries.map((entry, index) => {
            return (
                <tr key={index}>
                    <td>
                        <a href={`http://www.ncbi.nlm.nih.gov/protein/${entry.accession}`} target="_blank">
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

            taxonomy[key] = entries.map(entry =>
                <ListGroupItem key={entry.name}>
                    {entry.name} <Badge>{entry.count}</Badge>
                </ListGroupItem>
            );
        });

        const listGroupStyle = {
            maxHeight: 210,
            overflowY: "auto"
        };

        return (
            <div>
                <h3 className="view-header">
                    <strong>{this.props.detail.label}</strong>
                </h3>

                <Table bordered>
                    <tbody>
                    <tr>
                        <th className="col-md-3">Cluster</th>
                        <td className="col-md-9">{this.props.detail.cluster}</td>
                    </tr>

                    {idField}

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
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        detail: state.hmms.detail,
        showIds: state.account.settings.show_ids
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (hmmId) => {
            dispatch(getHmm(hmmId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMDetail);

export default Container;
