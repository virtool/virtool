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
    <div className="container">
        <Switch>
            <Route path="/hmm" component={HMMList} exact />
            <Route path="/hmm/:hmmId" component={HMMDetail} />
        </Switch>
    </div>
);

export default HMM;
