import React from "react";
import { Switch, Route } from "react-router-dom";

import OTUList from "./List";

export default function OTUs () {
    return (
        <div className="container">
            <Switch>
                <Route path="/refs/:refId/kinds" component={KindsList} exact/>
            </Switch>
        </div>
    );
}
