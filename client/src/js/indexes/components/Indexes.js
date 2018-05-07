import React from "react";
import { Switch, Route } from "react-router-dom";

import IndexesList from "./List";
import IndexDetail from "./Detail";

const Indexes = () => (
    <Switch>
        <Route path="/otus/indexes" component={IndexesList} exact />
        <Route path="/otus/indexes/:indexVersion" component={IndexDetail} />
    </Switch>
);

export default Indexes;
