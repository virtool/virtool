import React, { useEffect } from "react";
import { connect } from "react-redux";
import { Input } from "../../../base";
import { findUsers } from "../../../users/actions";

const AddUserSearch = ({ term, onChange }) => {
    // Zero user search on unmount.
    useEffect(() => {
        return () => {
            onChange("");
        };
    });

    return <Input type="text" value={term} onChange={e => onChange(e.target.value)} />;
};

const mapStateToProps = state => ({
    term: state.users.term
});

const mapDispatchToProps = dispatch => ({
    onChange: term => {
        dispatch(findUsers(term, 1));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AddUserSearch);
