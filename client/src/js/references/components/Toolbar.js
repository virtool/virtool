import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Icon, Button } from "../../base";
import { filterReferences } from "../actions";

const ReferenceToolbar = ({ filter, onFilter, canCreate }) => (
    <div className="toolbar">
        <div className="form-group">
            <div className="input-group">
                <span id="find-addon" className="input-group-addon">
                    <Icon name="search" />
                </span>
                <input
                    aria-describedby="find-addon"
                    className="form-control"
                    type="text"
                    placeholder="Reference name"
                    value={filter}
                    onChange={onFilter}
                />
            </div>
        </div>

        {canCreate ? (
            <Link to={{state: {newReference: true, createReference: true}}}>
                <Button bsStyle="primary" tip="Create">
                    <Icon name="plus-square" />
                </Button>
            </Link>
        ) : null}
    </div>
);

const mapStateToProps = (state) => ({
    filter: state.references.filter
});

const mapDispatchToProps = (dispatch) => ({

    onFilter: (e) => {
        dispatch(filterReferences(e.target.value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceToolbar);
