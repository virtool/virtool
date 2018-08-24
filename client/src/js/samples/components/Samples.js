import React from "react";
import { Switch, Route } from "react-router-dom";
import { connect } from "react-redux";

import FileManager from "../../files/components/Manager";
import SamplesList from "./List";
import SampleDetail from "./Detail";
import UniqueNames from "../../administration/components/General/UniqueNames";
import SampleRights from "../../administration/components/General/SampleRights";
import { LoadingPlaceholder } from "../../base";

export const SampleFileManager = () => (
    <FileManager fileType="reads" />
);

export const SampleSettings = () => (
    <div className="settings-container">
        <h3 className="view-header">
            <strong>
                Sample Settings
            </strong>
        </h3>
        <UniqueNames />
        <SampleRights />
    </div>
);

const Samples = (props) => {
    if (props.settings === null) {
        return <LoadingPlaceholder />;
    }

    return (
        <div className="container">
            <Switch>
                <Route path="/samples" component={SamplesList} exact />
                <Route path="/samples/files" component={SampleFileManager} exact />
                <Route path="/samples/settings" component={SampleSettings} />
                <Route path="/samples/:sampleId" component={SampleDetail} />
            </Switch>
        </div>
    );
};

const mapStateToProps = (state) => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Samples);
