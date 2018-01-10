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
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { without, intersection, filter, sortBy } from "lodash";
import { Overlay, Popover, Panel } from "react-bootstrap";

import { Icon, Input, Button, ListGroupItem } from "../../../base";
import ReadItem from "./ReadItem";

export default class ReadSelector extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            filter: ""
        };
    }

    static propTypes = {
        files: PropTypes.arrayOf(PropTypes.object),
        error: PropTypes.bool,
        selected: PropTypes.arrayOf(PropTypes.string),
        onSelect: PropTypes.func
    };

    componentWillReceiveProps (nextProps) {
        if (nextProps.files !== this.props.files) {
            this.props.onSelect(intersection(this.props.selected, nextProps.files.map(f => f["id"])));
        }
    }

    onSelect = (selectedId) => {
        let selected;

        if (this.props.selected.includes(selectedId)) {
            selected = without(this.props.selected, selectedId);
        } else {
            selected = this.props.selected.concat([selectedId]);

            if (selected.length === 3) {
                selected.shift();
            }
        }

        this.props.onSelect(selected);
    };

    reset = (e) => {
        e.preventDefault();
        this.setState({filter: ""}, () => this.props.onSelect([]));
    };

    render () {

        const loweredFilter = this.state.filter.toLowerCase();

        const files = filter(this.props.files, file =>
            !this.state.filter || file.name.toLowerCase().includes(loweredFilter)
        );

        let fileComponents = sortBy(files, "uploaded_at").reverse().map((file) =>
            <ReadItem
                key={file.id}
                {...file}
                selected={this.props.selected.includes(file.id)}
                onSelect={this.handleSelect}
            />
        );

        if (!fileComponents.length) {
            fileComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No read files found. <Link to="samples/files">Upload some</Link>.
                </ListGroupItem>
            );
        }

        let overlay;

        if (this.props.error) {
            overlay = (
                <Overlay container={this} target={this.panelNode} placement="top" show={true}>
                    <Popover id="read-error-popover" {...this.props}>
                        <span className="text-danger">At least one read file must be attached to the sample</span>
                    </Popover>
                </Overlay>
            );
        }

        return (
            <div>
                {overlay}

                <h5 style={{display: "flex", alignItems: "center"}}>
                    <strong style={{flex: "1 0 auto"}}>Read Files</strong>
                    <small className="text-muted pull-right">
                        {this.props.selected.length} of {fileComponents.length} selected
                    </small>
                </h5>

                <Panel ref={(node) => this.panelNode = node}>
                    <div className="toolbar">
                        <Input
                            type="text"
                            placeholder="Filename"
                            value={this.state.filter}
                            onChange={(e) => this.setState({filter: e.target.value})}
                        />
                        <Button type="button" tip="Clear" onClick={this.reset}>
                            <Icon name="reset" />
                        </Button>
                    </div>

                    <div className="panel panel-default">
                        <div className="list-group">
                            {fileComponents}
                        </div>
                    </div>
                </Panel>
            </div>
        );
    }
}
