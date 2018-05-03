import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";

import { createFindURL, getFindTerm } from "../../utils";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "../../base";
import { push } from "react-router-redux";

const SampleToolbar = ({canCreate, onFind, term}) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={term}
                    onChange={(e) => onFind(e.target.value)}
                    placeholder="Sample name"
                />
            </InputGroup>
        </FormGroup>

        {canCreate ? (
            <LinkContainer to={{state: {create: true}}}>
                <Button
                    tip="Create"
                    icon="plus-square"
                    bsStyle="primary"
                />
            </LinkContainer>
        ) : null}
    </div>
);

const mapStateToProps = (state) => ({
    term: getFindTerm(),
    canCreate: state.account.permissions.create_sample
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (term) => {
        const url = createFindURL({ find: term });
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SampleToolbar);
