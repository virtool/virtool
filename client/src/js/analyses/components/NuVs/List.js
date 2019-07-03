import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { get, includes, map, reject, xor } from "lodash-es";
import { DropdownButton, FormControl, FormGroup, InputGroup, ListGroup, MenuItem, Table } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { Button, Icon, Toolbar } from "../../../base";
import NuVsItem from "./Item";

const filterData = (data, filter) => {
    if (filter === "hmm") {
        return reject(data, { e: undefined });
    }

    if (filter === "orf") {
        return reject(data, { "result.orfs.length": 0 });
    }

    return data;
};

const filterTitles = {
    hmm: "Has HMM Hit",
    orf: "Has ORF",
    none: "None"
};

const FilterTitle = ({ filter }) => {
    const suffix = get(filterTitles, filter, "All");
    return <span>Filter: {suffix}</span>;
};

const StyledFilterDropdown = styled(DropdownButton)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    min-width: 170px;

    ul {
        min-width: 170px;
    }
`;

const FilterDropdown = ({ filter, onFilter }) => {
    const title = <FilterTitle filter={filter} />;
    return (
        <StyledFilterDropdown title={title} id="nuvs-visibility-filter" onSelect={onFilter} pullRight>
            <MenuItem eventKey="hmm">{filterTitles.hmm}</MenuItem>
            <MenuItem eventKey="orf">{filterTitles.orf}</MenuItem>
            <MenuItem eventKey="none">{filterTitles.none}</MenuItem>
        </StyledFilterDropdown>
    );
};

const NuVsDisplayCount = styled.div`
    color: ${props => props.theme.color.greyDark};
    font-size: ${props => props.theme.fontSize.xs};
    margin-bottom: 15px;
`;

const NuVsToolbar = styled(Toolbar)`
    margin-bottom: 5px;
`;

export default class NuVsList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            expanded: [],
            term: "",
            filter: "hmm"
        };
    }

    static propTypes = {
        analysisId: PropTypes.string,
        maxSequenceLength: PropTypes.number,
        data: PropTypes.arrayOf(PropTypes.object)
    };

    handleFilter = filter => this.setState({ filter });

    toggleIn = sequenceIndex => {
        this.setState({
            expanded: xor(this.state.expanded, [sequenceIndex])
        });
    };

    render() {
        const data = filterData(this.props.data, this.state.filter);

        const rows = map(data, item => {
            const expanded = includes(this.state.expanded, item.index);
            return (
                <NuVsItem
                    key={`sequence_${item.index}`}
                    {...item}
                    analysisId={this.props.analysisId}
                    toggleIn={this.toggleIn}
                    in={expanded}
                    maxSequenceLength={this.props.maxSequenceLength}
                />
            );
        });

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-md-3">Contig Count</th>
                            <td className="col-md-9">{this.props.data.length}</td>
                        </tr>
                    </tbody>
                </Table>
                <NuVsToolbar>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" />
                            </InputGroup.Addon>
                            <FormControl
                                value={this.state.findTerm}
                                onChange={e => this.setState({ findTerm: e.target.value })}
                                placeholder="Name, family"
                            />
                        </InputGroup>
                    </FormGroup>
                    <Button
                        tip="Collapse All"
                        icon="compress"
                        disabled={this.state.expanded.length === 0}
                        onClick={() => this.setState({ expanded: [] })}
                    />
                    <LinkContainer to={{ state: { export: true } }}>
                        <Button tip="Export" icon="download" />
                    </LinkContainer>
                    <FilterDropdown filter={this.state.filter} onFilter={this.handleFilter} />
                </NuVsToolbar>
                <NuVsDisplayCount>Displaying {data.length} sequences</NuVsDisplayCount>
                <ListGroup>{rows}</ListGroup>
            </div>
        );
    }
}
