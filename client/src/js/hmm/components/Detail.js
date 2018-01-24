import React from "react";
import { connect } from "react-redux";
import { map, sortBy } from "lodash-es";
import { Row, Col, Table, Badge, Label, Panel, ListGroup } from "react-bootstrap";

import { IDRow, ListGroupItem, LoadingPlaceholder } from "../../base";
import { getHmm } from "../actions";

const HMMTaxonomy = ({ counts }) => {

    const components = sortBy(map(counts, (count, name) => ({name, count})), "name").map(entry =>
        <ListGroupItem key={entry.name}>
            {entry.name} <Badge>{entry.count}</Badge>
        </ListGroupItem>
    );

    return (
        <ListGroup style={{maxHeight: 210, overflowY: "auto"}}>
            {components}
        </ListGroup>
    );
};

class HMMDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.hmmId);
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder maring="130px" />;
        }

        const clusterMembers = this.props.detail.entries.map((entry, index) =>
            <tr key={index}>
                <td>
                    <a href={`http://www.ncbi.nlm.nih.gov/protein/${entry.accession}`} target="_blank">
                        {entry.accession}
                    </a>
                </td>
                <td>{entry.name}</td>
                <td>{entry.organism}</td>
            </tr>
        );

        const names = this.props.detail.names.map((name, index) => <span key={index}><Label>{name}</Label> </span>);

        return (
            <div>
                <h3 className="view-header">
                    <strong>{this.props.detail.names[0]}</strong>
                </h3>

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
                        <h5>
                            <strong>Families</strong>
                        </h5>
                        <HMMTaxonomy counts={this.props.detail.families} />
                    </Col>
                    <Col md={6}>
                        <h5>
                            <strong>
                                Genera
                            </strong>
                        </h5>
                        <HMMTaxonomy counts={this.props.detail.genera} />
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.hmms.detail
});

const mapDispatchToProps = (dispatch) => ({

    onGet: (hmmId) => {
        dispatch(getHmm(hmmId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMDetail);

export default Container;
