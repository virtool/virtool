import React from "react";
import PropTypes from "prop-types";
import { assign, filter } from "lodash";
import { Table, FormGroup, InputGroup, FormControl, Dropdown, MenuItem } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, Checkbox } from "virtool/js/components/Base";

import NuVsList from "./List";

export default class NuVsController extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            findTerm: "",
            filterSequences: true,
            filterORFs: true
        };
    }

    static propTypes = {
        analysisId: PropTypes.string,
        maxSequenceLength: PropTypes.number,
        data: PropTypes.arrayOf(PropTypes.object)
    };

    setFindTerm = (event) => this.setState({findTerm: event.target.value});

    filter = (eventKey) => {

        switch (eventKey) {
            case "sequences":
                return this.setState({filterSequences: !this.state.filterSequences});
            case "orfs":
                return this.setState({filterORFs: !this.state.filterORFs});
            default:
                this.setState({
                    filterSequences: false,
                    filterORFs: false
                });
        }
    };

    render () {

        let data = this.props.data;

        if (this.state.filterORFs) {
            data = data.map(sequence => assign({}, sequence, {orfs: filter(sequence.orfs, {hasHmm: true})}));
        }

        if (this.state.filterSequences) {
            data = filter(data, sequence => sequence.hasSignificantOrf);
        }

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

                <div className="toolbar">
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                value={this.state.findTerm}
                                onChange={this.setFindTerm}
                                placeholder="Definition, family"
                            />
                        </InputGroup>
                    </FormGroup>
                    <Dropdown
                        id="job-clear-dropdown"
                        className="split-dropdown"
                        onSelect={this.handleSelect}
                         pullRight
                    >
                        <Button
                            title="Filter"
                            onClick={this.filter}
                            active={this.state.filterSequences || this.state.filterORFs}
                        >
                            <Icon name="filter" />
                        </Button>
                        <Dropdown.Toggle />
                        <Dropdown.Menu onSelect={this.filter}>
                            <MenuItem eventKey="sequences">
                                <Flex>
                                    <FlexItem>
                                        <Checkbox checked={this.state.filterSequences} />
                                    </FlexItem>
                                    <FlexItem pad={5}>
                                        Sequences
                                    </FlexItem>
                                </Flex>
                            </MenuItem>
                            <MenuItem eventKey="orfs">
                                <Flex>
                                    <FlexItem>
                                        <Checkbox checked={this.state.filterORFs} />
                                    </FlexItem>
                                    <FlexItem pad={5}>
                                        ORFs
                                    </FlexItem>
                                </Flex>
                            </MenuItem>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>

                <NuVsList
                    data={data}
                    analysisId={this.props.analysisId}
                    maxSequenceLength={this.props.maxSequenceLength}
                />
            </div>
        );
    }

}
