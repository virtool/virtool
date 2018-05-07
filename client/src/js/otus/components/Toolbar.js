import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Icon, Button } from "../../base";
import {createFindURL, getFindTerm} from "../../utils";

const OTUToolbar = ({ canModify, onFind, term, onFilter, search }) => (
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

        <LinkContainer to="/OTUs/indexes">
            <Button
                icon="filing"
                tip="Indexes"
            />
        </LinkContainer>

        <Button
            tip="Filter Unverified"
            onClick={() => onFilter("/OTUs?verified=false")}
            active={search === "?verified=false"}
        >
            <Icon name="filter" />
        </Button>

        {canModify ? (
            <LinkContainer to={{...window.location, state: {createOTU: true}}} replace>
                <Button bsStyle="primary" tip="Create">
                    <Icon name="new-entry" />
                </Button>
            </LinkContainer>
        ) : null}
    </div>
);

const mapStateToProps = (state) => ({
    canModify: state.account.permissions.modify_OTU,
    term: getFindTerm(),
    search: state.router.location.search
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (e) => {
        const url = createFindURL({ find: e.target.value });
        dispatch(push(url.pathname + url.search));
    },

    onFilter: (url) => {
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl === url) {
            dispatch(push("/OTUs"));
        } else {
            dispatch(push(url));
        }
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(OTUToolbar);
