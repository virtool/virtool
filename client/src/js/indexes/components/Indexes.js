/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Index
 */

import React from "react";
import { Switch, Route } from "react-router-dom";

import IndexesList from "./List";
import IndexDetail from "./Detail";

const Indexes = () => (
    <Switch>
        <Route path="/viruses/indexes" component={IndexesList} exact />
        <Route path="/viruses/indexes/:indexVersion" component={IndexDetail} />
    </Switch>
);

export default Indexes;
