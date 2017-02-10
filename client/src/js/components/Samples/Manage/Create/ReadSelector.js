/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ReadSelector
 */

import React from "react";
import FlipMove from "react-flip-move"
import { some, includes, pull, intersection, filter, endsWith, sortBy } from "lodash";
import { Overlay, Popover, Panel, Label } from "react-bootstrap";
import { Icon, Input, Button, getFlipMoveProps } from "virtool/js/components/Base";

import ReadItem from "./ReadItem";

const suffixes = [".fastq", ".fq", ".fastq.gz", ".fq.gz"];

const getAvailableFiles = () => {
    let files = dispatcher.db.files.find({
        file_type: "reads",
        ready: true
    });

    return filter(files, {reserved: false});
};

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
export default class ReadSelector extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            files: getAvailableFiles(),
            filter: "",
            showAll: false
        };
    }

    static propTypes = {
        select: React.PropTypes.func,
        selected: React.PropTypes.arrayOf(React.PropTypes.string),
        readError: React.PropTypes.bool
    };

    componentDidMount () {
        dispatcher.db.files.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.update);
    }

    handleSelect = (selectedId) => {
        let selected = this.props.selected.slice(0);

        if (includes(selected, selectedId)) {
            pull(selected, selectedId);
        } else {
            if (this.props.selected.length === 2) selected.shift();
            selected.push(selectedId);
        }

        this.props.select(selected);
    };

    handleChange = (event) => this.setState({filter: event.target.value});

    reset = () => this.setState({filter: ""}, () => this.props.select([]));

    toggleShowAll = () => this.setState({showAll: !this.state.showAll});

    update = () => {
        const files = getAvailableFiles();

        this.setState({files: files}, () => {
            this.props.select(intersection(this.props.selected, files.map(f => f["_id"])));
        });
    };

    render () {

        const loweredFilter = this.state.filter.toLowerCase();

        const files = filter(this.state.files, file =>
            (this.state.showAll || some(suffixes.map(suffix => endsWith(file.name, suffix)))) &&
            (!this.state.filter || includes(file.name.toLowerCase(), loweredFilter))
        );

        const fileComponents = sortBy(files, "timestamp").reverse().map((file) =>
            <ReadItem
                key={file._id}
                {...file}
                selected={includes(this.props.selected, file._id)}
                onSelect={this.handleSelect}
            />
        );

        let overlay;

        if (this.props.readError) {
            overlay = (
                <Overlay target={this.panelNode} container={this} placement="top" show={true}>
                    <Popover id="read-error-popover">
                        <span className="text-danger">At least one read file must be attached to the sample</span>
                    </Popover>
                </Overlay>
            );
        }
        
        return (
            <div>
                <label className="control-label">
                    Read Files <Label>{this.props.selected.length}/{fileComponents.length} selected</Label>
                </label>

                <Panel ref={(node) => this.panelNode = node}>
                    <div style={{display: "flex"}}>
                        <div style={{flex: "1 1 auto"}}>
                            <Input
                                type="text"
                                onChange={this.handleChange}
                                value={this.state.filter}
                                placeholder="Filename"
                            />
                        </div>
                        <div style={{flex: "0 0 auto", paddingLeft: "5px"}}>
                            <Button onClick={this.reset}>
                                <Icon name="reset" /> Clear
                            </Button>
                        </div>
                        <div style={{flex: "0 0 auto", paddingLeft: "5px"}}>
                            <Button onClick={this.toggleShowAll} active={this.state.showAll}>
                                <Icon name="eye" /> Show All
                            </Button>
                        </div>
                    </div>

                    <div className="panel panel-default">
                        <FlipMove
                            {...getFlipMoveProps()}
                            className="list-group"
                            style={{minHeight: "420px", maxHeight: "420px", overflowY: "scroll"}}
                        >
                            {fileComponents}
                        </FlipMove>
                    </div>
                </Panel>

                {overlay}
            </div>
        );
    }
}
