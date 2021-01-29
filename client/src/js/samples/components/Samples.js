import React from "react";
import { Route, Switch } from "react-router-dom";
import { NarrowContainer, Container } from "../../base";

import FileManager from "../../files/components/Manager";
import Labels from "../../labels/components/Labels";
import SampleDetail from "./Detail";
import SamplesList from "./List";
import SamplesSettings from "./Settings";
import CreateSample from "./Create/Create";

export const SampleFileManager = () => (
    <NarrowContainer>
        <FileManager fileType="reads" />
    </NarrowContainer>
);

export const Samples = () => (
    <Container>
        <Switch>
            <Route path="/samples" component={SamplesList} exact />
            <Route path="/samples/files" component={SampleFileManager} exact />
            <Route path="/samples/settings" component={SamplesSettings} />
            <Route path="/samples/labels" component={Labels} exact />
            <Route path="/samples/create" component={CreateSample} />
            <Route path="/samples/:sampleId" component={SampleDetail} />
        </Switch>
    </Container>
);

export default Samples;
