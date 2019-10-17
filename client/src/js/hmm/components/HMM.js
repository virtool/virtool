import React from "react";
import { Route, Switch } from "react-router-dom";
import { Container } from "../../base";

import HMMList from "./List";
import HMMDetail from "./Detail";
import HMMSettings from "./Settings";

const HMM = () => (
    <Container>
        <Switch>
            <Route path="/hmm" component={HMMList} exact />
            <Route path="/hmm/settings" component={HMMSettings} />
            <Route path="/hmm/:hmmId" component={HMMDetail} />
        </Switch>
    </Container>
);

export default HMM;
