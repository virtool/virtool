import React from "react";
import { connect } from "react-redux";
import { SearchInput, Toolbar } from "../../base";
import { findHmms } from "../actions";
import { getStateTerm } from "../selectors";

export const HMMToolbar = ({ onFind, term }) => (
    <Toolbar>
        <SearchInput placeholder="Definition" onChange={onFind} value={term} />
    </Toolbar>
);

export const mapStateToProps = state => ({
    term: getStateTerm(state)
});

export const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findHmms(e.target.value, 1));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(HMMToolbar);
