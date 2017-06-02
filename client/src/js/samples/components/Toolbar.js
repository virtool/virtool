import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";

import { findSamples } from "../actions";
import { FormGroup, InputGroup, FormControl, ButtonGroup } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

class SampleToolbar extends React.Component {

    static propTypes = {
        term: React.PropTypes.string,
        onTermChange: React.PropTypes.func
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    render = () => (
        <div key="toolbar" className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl
                        type="text"
                        inputRef={(node) => this.inputNode = node}
                        value={this.props.term}
                        onChange={(e) => this.props.onTermChange(e.target.value)}
                        placeholder="Sample name"
                    />
                </InputGroup>
            </FormGroup>

            {/*

            <ButtonGroup>
                <Button
                    tip="Show Active"
                    icon="play"
                    active={!this.state.archived}
                    onClick={this.state.archived ? () => this.toggleFlag("archived"): null}
                />

                <Button
                    tip="Show Archived"
                    icon="box-add"
                    active={this.state.archived}
                    onClick={this.state.archived ? null: () => this.toggleFlag("archived")}
                />
            </ButtonGroup>

            <Button
                tip="Show Imported"
                icon="filing"
                active={this.state.imported}
                disabled={this.state.archived}
                onClick={() => this.toggleFlag("imported")}
            />

            <Button
                tip="Show Analyzed"
                icon="bars"
                active={this.state.analyzed}
                disabled={this.state.archived}
                onClick={() => this.toggleFlag("analyzed")}
            />

            */}

            <LinkContainer to="/samples/create">
                <Button tip="Create" icon="new-entry" bsStyle="primary" />
            </LinkContainer>
        </div>
    );
}

const mapStateToProps = (state) => {
    return {
        term: state.samples.term
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onTermChange: (term) => {
            dispatch(findSamples(term));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleToolbar);

export default Container;
