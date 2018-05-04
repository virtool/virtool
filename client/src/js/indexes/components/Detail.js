import React from "react";
import Helmet from "react-helmet";
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
                <Helmet>
                    <title>{`Virus Index ${indexVersion} - Indexes`}</title>
                </Helmet>
                <h3 className="view-header">
                    <strong>Virus Index {indexVersion}</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/viruses/indexes/${indexVersion}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/viruses/indexes/${indexVersion}/changes`}>
                        <NavItem>Changes  <Badge>{this.props.detail.change_count}</Badge></NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect
                        from="/viruses/indexes/:indexVersion"
                        to={`/viruses/indexes/${indexVersion}/general`}
                        exact
                    />
                    <Route path="/viruses/indexes/:indexVersion/general" component={IndexGeneral} />
                    <Route path="/viruses/indexes/:indexVersion/changes" component={IndexChanges} />
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
