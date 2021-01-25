import React from "react";
import { Route, Switch } from "react-router-dom";
import { Container, NarrowContainer } from "../../base";

import HMMList from "./List";
import HMMDetail from "./Detail";
import HMMSettings from "./Settings";

const HMM = () => (
    <Container>
        <NarrowContainer>
            <Switch>
                <Route path="/hmm" component={HMMList} exact />
                <Route path="/hmm/settings" component={HMMSettings} />
                <Route path="/hmm/:hmmId" component={HMMDetail} />
            </Switch>
        </NarrowContainer>
    </Container>
);

export default HMM;
