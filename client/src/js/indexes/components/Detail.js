import React from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Nav, NavItem } from "react-bootstrap";

import IndexGeneral from "./General";
import IndexChanges from "./Changes";
import { getIndex } from "../actions";
import { LoadingPlaceholder } from "../../base";

class IndexDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const indexVersion = this.props.match.params.indexVersion;

        return (
            <div>
                <h3 className="view-header">
                    <strong>OTU Index {indexVersion}</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/otus/indexes/${indexVersion}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/otus/indexes/${indexVersion}/changes`}>
                        <NavItem>Changes  <Badge>{this.props.detail.change_count}</Badge></NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect
                        from="/otus/indexes/:indexVersion"
                        to={`/otus/indexes/${indexVersion}/general`}
                        exact
                    />
                    <Route path="/otus/indexes/:indexVersion/general" component={IndexGeneral} />
                    <Route path="/otus/indexes/:indexVersion/changes" component={IndexChanges} />
                </Switch>
            </div>
        );
    }

}

const mapStateToProps = (state) => ({
    detail: state.indexes.detail
});

const mapDispatchToProps = (dispatch) => ({

    onGet: (indexVersion) => {
        dispatch(getIndex(indexVersion));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IndexDetail);
