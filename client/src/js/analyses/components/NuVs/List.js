import React from "react";
import PropTypes from "prop-types";
import FlipMove from "react-flip-move";
import { flatten, includes, isEmpty, map, reject, xor } from "lodash-es";
import { FormControl, FormGroup, InputGroup, Table } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { Button, Icon } from "../../../base/index";
import NuVsEntry from "./Entry";
import NuVsExpansion from "./Expansion";

export default class NuVsList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            expanded: [],
            findTerm: "",
            filter: true
        };
    }

    static propTypes = {
        analysisId: PropTypes.string,
        maxSequenceLength: PropTypes.number,
        data: PropTypes.arrayOf(PropTypes.object)
    };

    toggleIn = sequenceIndex => {
        this.setState({
            expanded: xor(this.state.expanded, [sequenceIndex])
        });
    };

    render() {
        let data;

        if (this.state.filter) {
            data = map(this.props.data, sequence => ({
                ...sequence,
                orfs: reject(sequence.orfs, orf => isEmpty(orf.hits))
            }));
        } else {
            data = this.props.data;
        }

        const rows = map(flatten(data), (item, index) => {
            const expanded = includes(this.state.expanded, item.index);

            const components = [
                <NuVsEntry key={`sequence_${item.index}`} {...item} toggleIn={this.toggleIn} in={expanded} />
            ];

            if (expanded) {
                components.push(
                    <NuVsExpansion
                        key={index}
                        {...item}
                        analysisId={this.props.analysisId}
                        maxSequenceLength={this.props.maxSequenceLength}
                    />
                );
            }

            return components;
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

                <div className="toolbar">
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
                    <Button
                        tip="Filter ORFs"
                        icon="filter"
                        active={this.state.filter}
                        onClick={() => this.setState({ filter: !this.state.filter })}
                    />
                </div>

                <FlipMove
                    typeName="div"
                    className="list-group"
                    enterAnimation="accordionVertical"
                    leaveAnimation={false}
                >
                    {rows}
                </FlipMove>
            </div>
        );
    }
}
