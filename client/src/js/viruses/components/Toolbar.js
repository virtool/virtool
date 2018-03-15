import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Icon, Button } from "../../base";
import {createFindURL, getFindTerm} from "../../utils";

const VirusToolbar = ({ canModify, onFind, term, onFilter }) => (
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
                    placeholder="Name or abbreviation"
                    value={term}
                    onChange={onFind}
                />
            </div>
        </div>

        <LinkContainer to="/viruses/indexes">
            <Button
                icon="filing"
                tip="Indexes"
            />
        </LinkContainer>

        <Button tip="Filter Unverified" onClick={() => onFilter("/viruses?verified=false")}>
            <Icon name="filter" />
        </Button>

        {canModify ? (
            <LinkContainer to={{...window.location, state: {createVirus: true}}} replace>
                <Button bsStyle="primary" tip="Create">
                    <Icon name="new-entry" />
                </Button>
            </LinkContainer>
        ) : null}
    </div>
);

const mapStateToProps = (state) => ({
    canModify: state.account.permissions.modify_virus,
    term: getFindTerm()
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (e) => {
        const url = createFindURL({ find: e.target.value });
        dispatch(push(url.pathname + url.search));
    },

    onFilter: (url) => {
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl === url) {
            dispatch(push("/viruses"));
        } else {
            dispatch(push(url));
        }
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusToolbar);

export default Container;
