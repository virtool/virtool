import { get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { Badge, BoxGroup, Label, LoadingPlaceholder, NotFound, Table, ViewHeader } from "../../base";
import { getHmm } from "../actions";
import { HMMTaxonomy } from "./Taxonomy";

const ClusterTable = styled(Table)`
    border: none;
    display: flex;
    flex-flow: column;
    height: 330px !important;
    margin: 0;
    width: 100%;

    thead {
        flex: 0 0 auto;
        width: calc(100% - 0.9em);

        th {
            border-bottom: none;
        }
    }

    tbody {
        flex: 1 1 auto;
        display: block;
        overflow-y: auto;
        border-top: 1px solid #dddddd;

        tr {
            width: 100%;
        }

        tr:first-child td {
            border-top: none;
        }
    }

    thead,
    tbody tr {
        display: table;
        table-layout: fixed;
    }
`;

const TaxonomyGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 15px;

    @media (max-width: 720px) {
        grid-template-columns: 1fr;
    }

    h5 {
        font-weight: bold;
    }
`;

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
            <Label key={index} spaced>
                {name}
            </Label>
        ));

        return (
            <div>
                <ViewHeader title={`${this.props.detail.names[0]} - HMMs`}>
                    <strong>{this.props.detail.names[0]}</strong>
                </ViewHeader>

                <Table>
                    <tbody>
                        <tr>
                            <th>Cluster</th>
                            <td>{this.props.detail.cluster}</td>
                        </tr>

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

                <BoxGroup>
                    <ClusterTable>
                        <thead>
                            <tr>
                                <th>Accession</th>
                                <th>Name</th>
                                <th>Organism</th>
                            </tr>
                        </thead>
                        <tbody>{clusterMembers}</tbody>
                    </ClusterTable>
                </BoxGroup>

                <TaxonomyGrid>
                    <div>
                        <h5>Families</h5>
                        <HMMTaxonomy counts={this.props.detail.families} />
                    </div>
                    <div>
                        <h5>Genera</h5>
                        <HMMTaxonomy counts={this.props.detail.genera} />
                    </div>
                </TaxonomyGrid>
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
