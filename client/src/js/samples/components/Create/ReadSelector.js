import { filter, includes, indexOf, intersection, isEqual, map, sortBy, toLower, without } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Box, BoxGroup, Button, InputError, NoneFoundSection, SearchInput, Toolbar } from "../../../base";

import ReadItem from "./ReadItem";

const ReadSelectorBox = styled(Box)`
    ${props => (props.error ? `border-color: ${props.theme.color.red};` : "")};
`;

export const ReadSelectorButton = styled(Button)`
    min-width: 44px;
`;

const ReadSelectorError = styled(InputError)`
    margin-bottom: 10px;
`;

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
                <NoneFoundSection noun="files">
                    <Link to="samples/files">Upload some</Link>
                </NoneFoundSection>
            );
        }

        return (
            <div>
                <ReadSelectorHeader>
                    <strong>Read Files</strong>
                    <small>
                        {this.props.selected.length} of {fileComponents.length} selected
                    </small>
                </ReadSelectorHeader>

                <ReadSelectorBox error={this.props.error}>
                    <Toolbar>
                        <SearchInput
                            placeholder="Filename"
                            value={this.state.filter}
                            onChange={e => this.setState({ filter: e.target.value })}
                        />
                        <ReadSelectorButton type="button" icon="undo" tip="Clear" onClick={this.reset} />
                        <ReadSelectorButton type="button" icon="retweet" tip="Swap Orientations" onClick={this.swap} />
                    </Toolbar>

                    <ReadSelectorList>
                        <BoxGroup>{fileComponents}</BoxGroup>
                    </ReadSelectorList>

                    <ReadSelectorError>{this.props.error}</ReadSelectorError>
                </ReadSelectorBox>
            </div>
        );
    }
}
