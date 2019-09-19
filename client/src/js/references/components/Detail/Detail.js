import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import { Badge, LoadingPlaceholder, NotFound, TabLink, Tabs } from "../../../base";
import IndexDetail from "../../../indexes/components/Detail";
import Indexes from "../../../indexes/components/Indexes";
import OTUDetail from "../../../otus/components/Detail/Detail";
import OTUList from "../../../otus/components/List";
import { checkRefRight } from "../../../utils/utils";
import { getReference } from "../../actions";
import EditReference from "./Edit";
import ReferenceDetailHeader from "./Header";
import ReferenceManage from "./Manage";
import { ReferenceSettings } from "./Settings";

class ReferenceDetail extends React.Component {
    constructor(props) {
        super(props);
        this.props.onGetReference(this.props.match.params.refId);
    }

    render = () => {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { id, otu_count, remotes_from } = this.props.detail;

        return (
            <div className="detail-container">
                <Switch>
                    <Route path="/refs/:refId/otus/:otuId" component={OTUDetail} />
                    <Route path="/refs/:refId/indexes/:indexId" component={IndexDetail} />
                    <Route
                        path="/refs"
                        render={() => (
                            <div>
                                <ReferenceDetailHeader />

                                <Tabs>
                                    <TabLink to={`/refs/${id}/manage`}>Manage</TabLink>
                                    <TabLink to={`/refs/${id}/otus`}>
                                        OTUs <Badge>{otu_count}</Badge>
                                    </TabLink>
                                    <TabLink to={`/refs/${id}/indexes`}>Indexes</TabLink>
                                    <TabLink to={`/refs/${id}/settings`}>Settings</TabLink>
                                </Tabs>

                                <Switch>
                                    <Redirect from="/refs/:refId" to={`/refs/${id}/manage`} exact />
                                    <Route path="/refs/:refId/manage" component={ReferenceManage} />
                                    <Route path="/refs/:refId/otus" component={OTUList} />
                                    <Route path="/refs/:refId/indexes" component={Indexes} />
                                    <Route
                                        path="/refs/:refId/settings"
                                        render={() => <ReferenceSettings isRemote={remotes_from} />}
                                    />
                                </Switch>

                                <EditReference />
                            </div>
                        )}
                    />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_REFERENCE_ERROR", null),
    detail: state.references.detail,
    pathname: state.router.location.pathname,
    canModify: checkRefRight(state, "modify")
});

const mapDispatchToProps = dispatch => ({
    onGetReference: refId => {
        dispatch(getReference(refId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceDetail);
