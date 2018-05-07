import React from "react";
import { Switch, Route } from "react-router-dom";

import IndexesList from "./List";
import IndexDetail from "./Detail";

const Indexes = () => (
    <Switch>
        <Route path="/OTUs/indexes" component={IndexesList} exact />
        <Route path="/OTUs/indexes/:indexVersion" component={IndexDetail} />
    </Switch>
);

export default Indexes;
