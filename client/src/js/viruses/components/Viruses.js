import React from "react";
import { Switch, Route } from "react-router-dom";
import { connect } from "react-redux";

import VirusesList from "./List";
import VirusDetail from "./Detail/Detail";
import Indexes from "../../indexes/components/Indexes";
import { LoadingPlaceholder } from "../../base";
import SourceTypes from "../../settings/components/General/SourceTypes";
import InternalControl from "../../settings/components/General/InternalControl";

const VirusSettings = () => (
    <div>
        <h3 className="view-header">
            <strong>
                Viruses Settings
            </strong>
        </h3>
        <SourceTypes />
        <InternalControl />
    </div>
);

const Viruses = (props) => {
    let content;

    if (props.settings === null) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <div className="container">
                <Switch>
                    <Route path="/viruses" component={VirusesList} exact />
                    <Route path="/viruses/create" component={VirusesList} />
                    <Route path="/viruses/settings" component={VirusSettings} />
                    <Route path="/viruses/indexes" component={Indexes} />
                    <Route path="/viruses/:virusId" component={VirusDetail} />
                </Switch>
            </div>
        );
    }

    return content;
};

const mapStateToProps = (state) => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Viruses);
