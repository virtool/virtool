import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { connect } from "react-redux";

import OTUDetail from "../../otus/components/Detail/Detail";
import IndexDetail from "../../indexes/components/Detail";
import { LoadingPlaceholder } from "../../base";
import SourceTypes from "../../administration/components/General/SourceTypes";
import ReferenceList from "./List";
import ReferenceDetail from "./Detail/Detail";

export const ReferenceSettings = () => (
    <div className="settings-container">
        <h3 className="view-header">
            <strong>Settings</strong>
        </h3>
        <SourceTypes />
    </div>
);

const References = props => {
    if (props.settings === null) {
        return <LoadingPlaceholder />;
    }

    return (
        <div className="container">
            <Switch>
                <Route path="/refs" component={ReferenceList} exact />
                <Redirect from="/refs/settings/*" to="/refs/settings" />
                <Route path="/refs/settings" component={ReferenceSettings} />
                <Route path="/refs/:refId/otus/:otuId" component={OTUDetail} />
                <Route path="/refs/:refId/indexes/:indexId" component={IndexDetail} />
                <Route path="/refs/:refId" component={ReferenceDetail} />
            </Switch>
        </div>
    );
};

const mapStateToProps = state => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(References);
