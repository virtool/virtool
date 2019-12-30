import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import { LoadingPlaceholder, NotFound } from "../../../base";
import IndexDetail from "../../../indexes/components/Detail";
import Indexes from "../../../indexes/components/Indexes";
import OTUDetail from "../../../otus/components/Detail/Detail";
import OTUList from "../../../otus/components/List";
import { checkRefRight } from "../../../utils/utils";
import { getReference } from "../../actions";
import EditReference from "./Edit";
import ReferenceManage from "./Manage";
import ReferenceSettings from "./Settings";

class ReferenceDetail extends React.Component {
    constructor(props) {
        super(props);
        this.props.onGetReference(this.props.match.params.refId);
    }

    render = () => {
        if (this.props.error) {
            return <NotFound />;
        }

        if (!this.props.id || this.props.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        return (
            <div className="detail-container">
                <Switch>
                    <Route path="/refs/:refId/otus/:otuId" component={OTUDetail} />
                    <Route path="/refs/:refId/indexes/:indexId" component={IndexDetail} />
                    <Redirect from="/refs/:refId" to={`/refs/${this.props.id}/manage`} exact />
                    <Route path="/refs/:refId/manage" component={ReferenceManage} />
                    <Route path="/refs/:refId/otus" component={OTUList} />
                    <Route path="/refs/:refId/indexes" component={Indexes} />
                    <Route path="/refs/:refId/settings" component={ReferenceSettings} />
                </Switch>

                <EditReference />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    canModify: checkRefRight(state, "modify"),
    error: get(state, "errors.GET_REFERENCE_ERROR", null),
    id: get(state, "references.detail.id"),
    pathname: state.router.location.pathname
});

const mapDispatchToProps = dispatch => ({
    onGetReference: refId => {
        dispatch(getReference(refId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail);
