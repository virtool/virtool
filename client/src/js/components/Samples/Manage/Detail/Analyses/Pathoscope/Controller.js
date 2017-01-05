import React from "react";
import { assign, xor, sortBy, sum, map, filter } from "lodash-es";
import { Icon, Flex, FlexItem, Button, Checkbox } from "virtool/js/components/Base";
import { Dropdown, MenuItem, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import PathoscopeList from "./List";

export default class PathoscopeController extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            filterViruses: true,
            filterIsolates: true,

            findTerm: "",

            sortKey: "coverage",
            sortDescending: true,

            showReads: false,
            expanded: []
        };
    }

    static propTypes = {
        data: React.PropTypes.array,
        maxReadLength: React.PropTypes.number
    };

    collapseAll = () => this.setState({expanded: []});

    toggleIn = (virusId) => this.setState({expanded: xor(this.state.expanded, [virusId])});

    toggleShowReads = () => this.setState({showReads: !this.state.showReads});

    setFindTerm = (event) => this.setState({findTerm: event.target.value});

    setSortKey = (event) => this.setState({sortKey: event.target.value});

    toggleSortDescending = () =>this.setState({sortDescending: !this.state.sortDescending});

    filter = (eventKey) => {

        switch (eventKey) {

            case "viruses":
                this.setState({filterViruses: !this.state.filterViruses});
                break;

            case "isolates":
                this.setState({filterIsolates: !this.state.filterIsolates});
                break;

            default:
                this.setState({
                    filterViruses: false,
                    filterIsolates: false
                });
        }
    };

    render () {

        let data = sortBy(this.props.data, this.state.sortKey);

        if (this.state.filterViruses) {
            const totalReadsMapped = sum(map(data, "reads"));

            const re = this.state.findTerm ? new RegExp(this.state.findTerm, "i"): null;

            data = filter(data, (virus) => (
                (virus.pi * totalReadsMapped >= virus.ref_length * 0.8 / this.props.maxReadLength) &&
                (!re || (re.test(virus.abbreviation) || re.test(virus.name)))
            ));
        }

        if (this.state.filterIsolates) {
            data = data.map((virus) => {
                const minIsolateWeight = 0.03 * virus.pi;
                return assign({}, virus, filter(virus.isolates, isolate => isolate.pi >= minIsolateWeight));
            });
        }

        if (this.state.sortDescending) {
            data.reverse();
        }

        return (
            <div>
                <div>
                    <Flex>
                        <FlexItem grow={4}>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="search" /> Find
                                    </InputGroup.Addon>
                                    <FormControl value={this.state.findTerm} onChange={this.setFindTerm} />
                                </InputGroup>
                            </FormGroup>
                        </FlexItem>

                        <FlexItem pad>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="sort" /> Sort
                                    </InputGroup.Addon>
                                    <FormControl
                                        componentClass="select"
                                        value={this.state.sortKey}
                                        onChange={this.setSortKey}
                                    >
                                        <option className="text-primary" value="coverage">Coverage</option>
                                        <option className="text-success" value="pi">Weight</option>
                                        <option className="text-danger" value="best">Best Hit</option>
                                    </FormControl>
                                    <InputGroup.Button>
                                        <Button title="Sort Direction" onClick={this.toggleSortDescending}>
                                            <Icon name={this.state.sortDescending ? "sort-desc": "sort-asc"} />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </FormGroup>
                        </FlexItem>

                        <FlexItem pad>
                            <Button
                                title="Collapse"
                                onClick={this.collapseAll}
                                disabled={this.state.expanded.length === 0}
                            >
                                <Icon name="shrink" />
                            </Button>
                        </FlexItem>

                        <FlexItem pad>
                            <Button
                                title="Change Weight Format"
                                active={!this.state.showReads}
                                onClick={this.toggleShowReads}
                            >
                                <Icon name="pie" />
                            </Button>

                        </FlexItem>

                        <FlexItem pad>
                            <Dropdown
                                id="job-clear-dropdown"
                                onSelect={this.handleSelect}
                                className="split-dropdown"
                                pullRight
                            >
                                <Button
                                    title="Filter"
                                    onClick={this.filter}
                                    active={this.state.filterViruses || this.state.filterIsolates}
                                >
                                    <Icon name="filter" />
                                </Button>
                                <Dropdown.Toggle />
                                <Dropdown.Menu onSelect={this.filter}>
                                    <MenuItem eventKey="viruses">
                                        <Flex>
                                            <FlexItem>
                                                <Checkbox checked={this.state.filterViruses} />
                                            </FlexItem>
                                            <FlexItem pad={5}>
                                                Viruses
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
                        </FlexItem>
                    </Flex>
                </div>

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
