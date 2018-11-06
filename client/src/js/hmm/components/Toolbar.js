import React from "react";
import { connect } from "react-redux";
import { get } from "lodash-es";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { Icon } from "../../base";
import { findHmms } from "../actions";

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

const mapStateToProps = state => ({
    term: get(state, "hmms.term")
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findHmms(e.target.value, 1));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMToolbar);
