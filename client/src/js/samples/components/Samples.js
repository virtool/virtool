import React from "react";
import { Switch, Route } from "react-router-dom";

import FileManager from "../../files/components/Manager";
import SamplesList from "./List";
import SampleDetail from "./Detail";

const SampleFileManager = () => (
    <FileManager fileType="reads" />
);

const Samples = () => (
    <div className="container">
        <Switch>
            <Route path="/samples" component={SamplesList} exact />
            <Route path="/samples/files" component={SampleFileManager} exact />
            <Route path="/samples/:sampleId" component={SampleDetail} />
        </Switch>
    </div>
);

export default Samples;
