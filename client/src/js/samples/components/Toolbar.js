import React, { PropTypes } from "react";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

const SampleToolbar = (props) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={props.term}
                    onChange={(e) => props.onTermChange(e.target.value)}
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

        <LinkContainer to="/samples/files">
            <Button tip="Read Files" icon="folder-open" />
        </LinkContainer>

        <Button
            tip="Create Sample"
            icon="new-entry"
            bsStyle="primary"
            onClick={() => props.history.replace(props.location.pathname + props.location.search, {create: true})}
        />
    </div>
);

SampleToolbar.propTypes = {
    term: PropTypes.string,
    onTermChange: PropTypes.func,
    location: PropTypes.object,
    history: PropTypes.object,
};

export default SampleToolbar;
