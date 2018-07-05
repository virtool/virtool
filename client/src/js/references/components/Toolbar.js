import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { Icon, Button } from "../../base";
import {createFindURL, getFindTerm} from "../../utils";

const ReferenceToolbar = ({ onFind, term, canCreate }) => (
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
                    value={term}
                    onChange={onFind}
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
    term: getFindTerm(),
    search: state.router.location.search
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (e) => {
        const url = createFindURL({ find: e.target.value });
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceToolbar);
