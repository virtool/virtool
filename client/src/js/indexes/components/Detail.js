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
        this.props.onGet(this.props.match.params.indexVersion);
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const indexVersion = this.props.match.params.indexVersion;
        const refId = this.props.detail.reference.id;

        return (
            <div>
                <Helmet>
                    <title>{`OTU Index ${indexVersion} - Indexes`}</title>
                </Helmet>

                <Breadcrumb>
                    <Breadcrumb.Item>
                        <LinkContainer to={`/refs/${refId}/indexes`}>
                            <div>
                                Indexes
                            </div>
                        </LinkContainer>
                    </Breadcrumb.Item>
                    <Breadcrumb.Item active>OTU Index {indexVersion}</Breadcrumb.Item>
                </Breadcrumb>

                <h3 className="view-header">
                    <strong>OTU Index {indexVersion}</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/refs/${refId}/indexes/${indexVersion}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${refId}/indexes/${indexVersion}/changes`}>
                        <NavItem>Changes  <Badge>{this.props.detail.change_count}</Badge></NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect
                        from="/refs/:refId/indexes/:indexVersion"
                        to={`/refs/${refId}/indexes/${indexVersion}/general`}
                        exact
                    />
                    <Route path="/refs/:refId/indexes/:indexVersion/general" component={IndexGeneral} />
                    <Route path="/refs/:refId/indexes/:indexVersion/changes" component={IndexChanges} />
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
