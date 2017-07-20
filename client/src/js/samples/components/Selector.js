/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SampleSelector
 *
 */

import React from "react";
import { filter, map, some } from "lodash";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, FlexItem, Button } from "virtool/js/components/Base";
import { stringOrBool } from "virtool/js/propTypes";

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
export default class SampleSelector extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pending: false,
            algorithm: dispatcher.user.settings.quick_analyze_algorithm
        };
    }

    static propTypes = {
        archived: stringOrBool,
        selected: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        selectNone: React.PropTypes.func
    };

    setAlgorithm = (event) => {
        this.setState({
            algorithm: event.target.value
        });
    };

    archive = () => {
        const candidates = filter(this.props.selected, (document) =>
            !this.props.archived && (document.pathoscope || document.nuvs) === true
        );

        dispatcher.db.samples.request("archive", {_id: map(candidates, "_id")});
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.setState({pending: true}, () => {
            dispatcher.db.samples.request("analyze", {
                samples: map(this.props.selected, "_id"),
                algorithm: this.state.algorithm,
                name: null
            }).success(() => {
                this.setState({pending: false});
            }).failure(() => {
                this.setState({pending: false});
            });
        });
    };

    render () {

        const selectedCount = this.props.selected.length;

        let archiveButton;

        if (!this.props.archived && some(this.props.selected, {analyzed: true})) {
            archiveButton = (
                <FlexItem pad={5}>
                    <Button tip="Archive Samples" bsStyle="info" onClick={this.archive}>
                        <Icon name="box-add" />
                    </Button>
                </FlexItem>
            );
        }



        return (
            <div className="toolbar">
                <Button
                    style={{padding: "6px 15px", marginLeft: 0, marginRight: "3px"}}
                    onClick={this.props.selectNone}
                >
                    Selected {selectedCount}
                </Button>

                <form onSubmit={this.handleSubmit}>
                    <FormGroup bsClass="form-group no-margin">
                        <InputGroup>
                            <InputGroup.Addon>
                                Analyze
                            </InputGroup.Addon>
                            <FormControl
                                componentClass="select"
                                value={this.state.algorithm}
                                onChange={this.setAlgorithm}
                            >
                                <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                                <option value="nuvs">NuVs</option>
                            </FormControl>
                            <InputGroup.Button>
                                <Button type="submit" tip="Start Quick Analysis" bsStyle="success">
                                    <Icon name="bars" />
                                </Button>
                            </InputGroup.Button>
                        </InputGroup>
                    </FormGroup>
                </form>

                {archiveButton}
            </div>
        );
    }
}
