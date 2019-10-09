import React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { Icon } from "../../base";
import { findHmms } from "../actions";
import { getStateTerm } from "../selectors";

export const HMMToolbar = ({ onFind, term }) => (
    <FormGroup>
        <InputGroup>
            <InputGroup.Addon>
                <Icon name="search" />
            </InputGroup.Addon>
            <FormControl type="text" placeholder="Definition" onChange={onFind} value={term} />
        </InputGroup>
    </FormGroup>
);

export const mapStateToProps = state => ({
    term: getStateTerm(state)
});

export const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findHmms(e.target.value, 1, false));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMToolbar);
