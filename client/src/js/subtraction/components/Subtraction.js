import React from "react";
import { Switch, Route } from "react-router-dom";

import SubtractionList from "./List";
import SubtractionDetail from "./Detail";
import FileManager from "../../files/components/Manager";

export const SubtractionFileManager = () => (
    <FileManager fileType="subtraction" />
);

const Subtraction = () => (
    <div className="container">
        <Switch>
            <Route path="/subtraction" component={SubtractionList} exact />
            <Route path="/subtraction/files" component={SubtractionFileManager} />
            <Route path="/subtraction/:subtractionId" component={SubtractionDetail} />
        </Switch>
    </div>
);

export default Subtraction;
