import React from "react";
import Helmet from "react-helmet";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Nav, NavItem, Breadcrumb } from "react-bootstrap";

import IndexGeneral from "./General";
import IndexChanges from "./Changes";
import { getIndex } from "../actions";
import { LoadingPlaceholder } from "../../base";

class IndexDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.indexId);
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const indexId = this.props.detail.id;
        const version = this.props.detail.version;

        const refId = this.props.match.params.refId;

        return (
            <div>
                <Helmet>
                    <title>{`Index ${version} - Indexes - Virtool`}</title>
                </Helmet>

                <Breadcrumb>
                    <Breadcrumb.Item>
                        <LinkContainer to={`/refs/${refId}/indexes`}>
                            <div>
                                Indexes
                            </div>
                        </LinkContainer>
                    </Breadcrumb.Item>
                    <Breadcrumb.Item active>
                        Index {version}
                    </Breadcrumb.Item>
                </Breadcrumb>

                <h3 className="view-header">
                    <strong>Index {version}</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/refs/${refId}/indexes/${indexId}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${refId}/indexes/${indexId}/changes`}>
                        <NavItem>Changes  <Badge>{this.props.detail.change_count}</Badge></NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect
                        from="/refs/:refId/indexes/:indexId"
                        to={`/refs/${refId}/indexes/${indexId}/general`}
                        exact
                    />
                    <Route path="/refs/:refId/indexes/:indexId/general" component={IndexGeneral} />
                    <Route path="/refs/:refId/indexes/:indexId/changes" component={IndexChanges} />
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
