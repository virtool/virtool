import React from "react";
import { Switch, Route } from "react-router-dom";

import OTUsList from "./List";
import OTUDetail from "./Detail/Detail";

export default function OTUs () {
    return (
        <Switch>
            <Route path="/refs/:refId/otus" component={OTUsList} exact />
            <Route path="/refs/:refId/otus/:otuId" component={OTUDetail} />
        </Switch>
    );
}
