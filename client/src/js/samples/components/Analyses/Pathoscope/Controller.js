import React from "react";
import PropTypes from "prop-types";
import { filter, map, sortBy, sum, xor } from "lodash-es";
import { Icon, Flex, FlexItem, Button, Checkbox } from "../../../../base";
import { Row, Col, Dropdown, MenuItem, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import PathoscopeList from "./List";

export default class PathoscopeController extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            expanded: [],
            filterIsolates: true,
            filterOTUs: true,
            findTerm: "",
            showReads: false,
            sortDescending: true,
            sortKey: "coverage"
        };
    }

    static propTypes = {
        data: PropTypes.array,
        maxReadLength: PropTypes.number
    };

    collapseAll = () => {
        this.setState({
            expanded: []
        });
    };

    toggleIn = (otuId) => {
        this.setState({
            expanded: xor(this.state.expanded, [otuId])
        });
    };

    toggleShowReads = () => {
        this.setState({
            showReads: !this.state.showReads
        });
    };

    setSortKey = (e) => {
        this.setState({
            sortKey: e.target.value
        });
    };

    toggleSortDescending = () => {
        this.setState({
            sortDescending: !this.state.sortDescending
        });
    };

    filter = (eventKey) => {

        if (eventKey === "OTUs") {
            return this.setState({filterOTUs: !this.state.filterOTUs});
        }

        if (eventKey === "isolates") {
            return this.setState({filterIsolates: !this.state.filterIsolates});
        }

        const filterValue = !(this.state.filterOTUs && this.state.filterIsolates);

        return this.setState({
            filterOTUs: filterValue,
            filterIsolates: filterValue
        });
    };

    render () {

        let data = sortBy(this.props.data, this.state.sortKey);

        const re = this.state.findTerm ? new RegExp(this.state.findTerm, "i") : null;

        if (this.state.filterOTUs) {
            const totalReadsMapped = sum(map(data, "reads"));

            data = filter(data, otu => (
                (otu.pi * totalReadsMapped >= otu.length * 0.8 / this.props.maxReadLength) &&
                (!re || (re.test(otu.abbreviation) || re.test(otu.name)))
            ));
        } else {
            data = filter(data, (otu) => !re || (re.test(otu.abbreviation) || re.test(otu.name)));
        }

        if (this.state.filterIsolates) {
            data = map(data, otu => ({
                ...otu,
                isolates: filter(otu.isolates, isolate => (isolate.pi >= 0.03 * otu.pi))
            }));
        }

        if (this.state.sortDescending) {
            data.reverse();
        }

        return (
            <div>
                <Row>
                    <Col xs={12} md={7}>
                        <FormGroup>
                            <InputGroup>
                                <InputGroup.Addon>
                                    <Icon name="search" />
                                </InputGroup.Addon>
                                <FormControl
                                    value={this.state.findTerm}
                                    onChange={(e) => this.setState({findTerm: e.target.value})}
                                />
                            </InputGroup>
                        </FormGroup>
                    </Col>

                    <Col xs={12} md={5}>
                        <div className="toolbar">
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Button>
                                        <Button title="Sort Direction" onClick={this.toggleSortDescending}>
                                            <Icon name={this.state.sortDescending ? "sort-desc" : "sort-asc"} />
                                        </Button>
                                    </InputGroup.Button>
                                    <FormControl
                                        componentClass="select"
                                        value={this.state.sortKey}
                                        onChange={this.setSortKey}
                                    >
                                        <option className="text-primary" value="coverage">Coverage</option>
                                        <option className="text-success" value="pi">Weight</option>
                                        <option className="text-danger" value="best">Best Hit</option>
                                    </FormControl>
                                </InputGroup>
                            </FormGroup>

                            <Button
                                icon="shrink"
                                title="Collapse"
                                onClick={this.collapseAll}
                                className="hidden-xs"
                                disabled={this.state.expanded.length === 0}
                            />

                            <Button
                                icon="pie"
                                title="Change Weight Format"
                                active={!this.state.showReads}
                                className="hidden-xs"
                                onClick={this.toggleShowReads}
                            />

                            <Dropdown
                                id="job-clear-dropdown"
                                onSelect={this.handleSelect}
                                className="split-dropdown"
                                pullRight
                                style={{zIndex: "1"}}
                            >
                                <Button
                                    title="Filter"
                                    onClick={this.filter}
                                    active={this.state.filterOTUs || this.state.filterIsolates}
                                >
                                    <Icon name="filter" />
                                </Button>
                                <Dropdown.Toggle />
                                <Dropdown.Menu onSelect={this.filter}>
                                    <MenuItem eventKey="OTUs">
                                        <Flex>
                                            <FlexItem>
                                                <Checkbox checked={this.state.filterOTUs} />
                                            </FlexItem>
                                            <FlexItem pad={5}>
                                                OTUs
                                            </FlexItem>
                                        </Flex>
                                    </MenuItem>
                                    <MenuItem eventKey="isolates">
                                        <Flex>
                                            <FlexItem>
                                                <Checkbox checked={this.state.filterIsolates} />
                                            </FlexItem>
                                            <FlexItem pad={5}>
                                                Isolates
                                            </FlexItem>
                                        </Flex>
                                    </MenuItem>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Col>
                </Row>

                <PathoscopeList
                    data={data}
                    expanded={this.state.expanded}
                    toggleIn={this.toggleIn}
                    showReads={this.state.showReads}
                />
            </div>
        );
    }

}
