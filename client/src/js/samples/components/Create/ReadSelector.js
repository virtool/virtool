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
import { filter, includes, indexOf, isEqual, intersection, map, sortBy, toLower, without } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { FormGroup, InputGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { Button, Icon, Input, BoxGroup, Box, BoxGroupSection } from "../../../base";
import { Toolbar } from "../../../base/Toolbar";

import ReadItem from "./ReadItem";

const ReadSelectorHeader = styled.h5`
    display: flex;
    align-items: center;

    strong {
        flex: 1 0 auto;
    }

    small {
        color: grey;
    }
`;

const ReadSelectorList = styled.div`
    max-height: 400px;
    overflow-y: auto;

    & > div {
        margin-bottom: 0;
    }
`;

export default class ReadSelector extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            filter: ""
        };
    }

    static propTypes = {
        files: PropTypes.arrayOf(PropTypes.object),
        error: PropTypes.string,
        selected: PropTypes.arrayOf(PropTypes.string),
        onSelect: PropTypes.func,
        handleSelect: PropTypes.func
    };

    componentDidUpdate(prevProps) {
        if (!isEqual(this.props.files, prevProps.files)) {
            prevProps.onSelect(intersection(prevProps.selected, map(this.props.files, "id")));
        }
    }

    handleSelect = selectedId => {
        let selected;

        if (includes(this.props.selected, selectedId)) {
            selected = without(this.props.selected, selectedId);
        } else {
            selected = this.props.selected.concat([selectedId]);

            if (selected.length === 3) {
                selected.shift();
            }
        }

        this.props.onSelect(selected);
    };

    swap = () => {
        this.props.onSelect(this.props.selected.slice().reverse());
    };

    reset = e => {
        e.preventDefault();
        this.setState({ filter: "" }, () => this.props.onSelect([]));
    };

    render() {
        const error = this.props.error;

        const loweredFilter = toLower(this.state.filter);

        const files = filter(
            this.props.files,
            file => !this.state.filter || includes(toLower(file.name), loweredFilter)
        );

        let fileComponents = map(sortBy(files, "uploaded_at").reverse(), file => {
            const index = indexOf(this.props.selected, file.id);
            return (
                <ReadItem key={file.id} {...file} index={index} selected={index > -1} onSelect={this.handleSelect} />
            );
        });

        if (!fileComponents.length) {
            fileComponents = (
                <BoxGroupSection className="text-center">
                    <Icon name="info-circle" /> No read files found. <Link to="samples/files">Upload some</Link>.
                </BoxGroupSection>
            );
        }

        const inputErrorClassName = error ? "input-form-error" : "input-form-error-none";

        const errorMessage = (
            <div className={inputErrorClassName}>
                <div className="input-error-message">{error ? error : "None"}</div>
            </div>
        );

        return (
            <div>
                <ReadSelectorHeader>
                    <strong>Read Files</strong>
                    <small>
                        {this.props.selected.length} of {fileComponents.length} selected
                    </small>
                </ReadSelectorHeader>

                <Box>
                    <Toolbar>
                        <FormGroup>
                            <InputGroup>
                                <Input
                                    type="text"
                                    placeholder="Filename"
                                    value={this.state.filter}
                                    onChange={e => this.setState({ filter: e.target.value })}
                                />
                                <InputGroup.Button>
                                    <Button type="button" tip="Clear" onClick={this.reset}>
                                        <Icon name="redo" />
                                    </Button>
                                </InputGroup.Button>
                            </InputGroup>
                        </FormGroup>
                        <Button
                            type="button"
                            icon="retweet"
                            tip="Swap Orientations"
                            tipPlacement="top"
                            onClick={this.swap}
                        />
                    </Toolbar>
                    <ReadSelectorList>
                        <BoxGroup>{fileComponents}</BoxGroup>
                    </ReadSelectorList>

                    {errorMessage}
                </Box>
            </div>
        );
    }
}
