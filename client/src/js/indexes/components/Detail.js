import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import {
    Badge,
    Breadcrumb,
    BreadcrumbItem,
    LoadingPlaceholder,
    NotFound,
    RelativeTime,
    TabLink,
    Tabs,
    ViewHeader
} from "../../base";
import { getIndex, getIndexHistory } from "../actions";
import IndexChanges from "./Changes";
import IndexGeneral from "./General";

export const IndexDetailBreadCrumb = ({ refDetail, version }) => (
    <Breadcrumb>
        <BreadcrumbItem to="/refs/">References</BreadcrumbItem>
        <BreadcrumbItem to={`/refs/${refDetail.id}`}>{refDetail.name}</BreadcrumbItem>
        <BreadcrumbItem to={`/refs/${refDetail.id}/indexes`}>Indexes</BreadcrumbItem>
        <BreadcrumbItem>Index {version}</BreadcrumbItem>
    </Breadcrumb>
);

export class IndexDetail extends React.Component {
    componentDidMount() {
        this.props.onGetIndex(this.props.match.params.indexId);
        this.props.onGetChanges(this.props.match.params.indexId, 1);
    }

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null || this.props.refDetail === null) {
            return <LoadingPlaceholder />;
        }

        const indexId = this.props.detail.id;
        const { version, created_at, user } = this.props.detail;
        const refId = this.props.refDetail.id;

        return (
            <div>
                <IndexDetailBreadCrumb refDetail={this.props.refDetail} version={version} />

                <ViewHeader title={`Index ${version} - Indexes - Virtool`}>
                    <strong>Index {version}</strong>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                        Created <RelativeTime time={created_at} /> by {user.id}
                    </div>
                </ViewHeader>

                <Tabs>
                    <TabLink to={`/refs/${refId}/indexes/${indexId}/general`}>General</TabLink>
                    <TabLink to={`/refs/${refId}/indexes/${indexId}/changes`}>
                        Changes <Badge>{this.props.detail.change_count}</Badge>
                    </TabLink>
                </Tabs>

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

export const mapStateToProps = state => ({
    error: get(state, "errors.GET_INDEX_ERROR", null),
    detail: state.indexes.detail,
    refDetail: state.references.detail
});

export const mapDispatchToProps = dispatch => ({
    onGetIndex: indexId => {
        dispatch(getIndex(indexId));
    },

    onGetChanges: (indexId, page) => {
        dispatch(getIndexHistory(indexId, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(IndexDetail);
