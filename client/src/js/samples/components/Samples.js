import React from "react";
import { Switch, Route } from "react-router-dom";
import { connect } from "react-redux";

import FileManager from "../../files/components/Manager";
import SamplesList from "./List";
import SampleDetail from "./Detail";
import UniqueNames from "../../settings/components/General/UniqueNames";
import SampleRights from "../../settings/components/General/SampleRights";
import { LoadingPlaceholder } from "../../base";

const SampleFileManager = () => (
    <FileManager fileType="reads" />
);

const SampleSettings = () => (
    <div>
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
    let content;

    if (props.settings === null) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <div className="container">
                <Switch>
                    <Route path="/samples" component={SamplesList} exact />
                    <Route path="/samples/files" component={SampleFileManager} exact />
                    <Route path="/samples/settings" component={SampleSettings} />
                    <Route path="/samples/:sampleId" component={SampleDetail} />
                </Switch>
            </div>
        );
    }

    return content;
};

const mapStateToProps = (state) => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Samples);
