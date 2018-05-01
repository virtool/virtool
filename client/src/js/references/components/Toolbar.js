import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { Icon, Button } from "../../base";
import {createFindURL, getFindTerm} from "../../utils";

const ReferenceToolbar = ({ onFind, term }) => (
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

        <Link to={{state: {importReference: true}}}>
            <Button bsStyle="primary" tip="Import">
                Import
            </Button>
        </Link>

        <Link to={{state: {createReference: true}}}>
            <Button bsStyle="primary" tip="Create">
                Create
            </Button>
        </Link>
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
