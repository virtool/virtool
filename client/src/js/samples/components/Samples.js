import React from "react";
import { Switch, Route } from "react-router-dom";

import FileManager from "../../files/components/Manager";
import UniqueNames from "../../administration/components/UniqueNames";
import SampleRights from "../../administration/components/SampleRights";
import SampleDetail from "./Detail";
import SamplesList from "./List";

export const SampleFileManager = () => <FileManager fileType="reads" />;

export const SampleSettings = () => (
    <div className="settings-container">
        <h3 className="view-header">
            <strong>Sample Settings</strong>
        </h3>
        <UniqueNames />
        <SampleRights />
    </div>
);

export const Samples = () => (
    <div className="container">
        <Switch>
            <Route path="/samples" component={SamplesList} exact />
            <Route path="/samples/files" component={SampleFileManager} exact />
            <Route path="/samples/settings" component={SampleSettings} />
            <Route path="/samples/:sampleId" component={SampleDetail} />
        </Switch>
    </div>
);

export default Samples;
