import { get, map } from "lodash-es";
import React from "react";
import { Badge, Col, Label, Panel, Row, Table } from "react-bootstrap";
import { connect } from "react-redux";

import { IDRow, LoadingPlaceholder, NotFound, ViewHeader } from "../../base";
import { getHmm } from "../actions";
import { HMMTaxonomy } from "./Taxonomy";

class HMMDetail extends React.Component {
    componentDidMount() {
        this.props.onGet(this.props.match.params.hmmId);
    }

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder margin="130px" />;
        }

        const clusterMembers = map(this.props.detail.entries, ({ name, accession, organism }, index) => (
            <tr key={index}>
                <td>
                    <a
                        href={`http://www.ncbi.nlm.nih.gov/protein/${accession}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {accession}
                    </a>
                </td>
                <td>{name}</td>
                <td>{organism}</td>
            </tr>
        ));

        const names = map(this.props.detail.names, (name, index) => (
            <span key={index}>
                <Label>{name}</Label>
                &nbsp;
            </span>
        ));

        return (
            <div>
                <ViewHeader title={`${this.props.detail.names[0]} - HMMs`}>
                    <strong>{this.props.detail.names[0]}</strong>
                </ViewHeader>

                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-md-3">Cluster</th>
                            <td className="col-md-9">{this.props.detail.cluster}</td>
                        </tr>

                        <IDRow id={this.props.detail.id} />

                        <tr>
                            <th>Best Definitions</th>
                            <td>{names}</td>
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

                <h5>
                    <strong>Cluster Members</strong> <Badge>{this.props.detail.entries.length}</Badge>
                </h5>

                <Panel>
                    <Table className="cluster-table">
                        <thead>
                            <tr>
                                <th>Accession</th>
                                <th>Name</th>
                                <th>Organism</th>
                            </tr>
                        </thead>
                        <tbody>{clusterMembers}</tbody>
                    </Table>
                </Panel>

                <Row>
                    <Col md={6}>
                        <h5>
                            <strong>Families</strong>
                        </h5>
                        <HMMTaxonomy counts={this.props.detail.families} />
                    </Col>
                    <Col md={6}>
                        <h5>
                            <strong>Genera</strong>
                        </h5>
                        <HMMTaxonomy counts={this.props.detail.genera} />
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_HMM_ERROR", null),
    detail: state.hmms.detail
});

const mapDispatchToProps = dispatch => ({
    onGet: hmmId => {
        dispatch(getHmm(hmmId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMDetail);
