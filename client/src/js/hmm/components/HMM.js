/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMM
 */

import React from "react";
import { Route, Switch } from "react-router-dom";

import HMMList from "./List";
import HMMDetail from "./Detail";

const HMM = () => (
    <Switch>
        <Route path="/viruses/hmms" component={HMMList} exact />
        <Route path="/viruses/hmms/:hmmId" component={HMMDetail} />
    </Switch>
);

export default HMM;
