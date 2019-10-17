import React from "react";
import { Route, Switch } from "react-router-dom";
import { Container } from "../../base";

import FileManager from "../../files/components/Manager";
import SubtractionDetail from "./Detail";
import SubtractionList from "./List";

export const SubtractionFileManager = () => <FileManager fileType="subtraction" />;

const Subtraction = () => (
    <Container>
        <Switch>
            <Route path="/subtraction" component={SubtractionList} exact />
            <Route path="/subtraction/files" component={SubtractionFileManager} />
            <Route path="/subtraction/:subtractionId" component={SubtractionDetail} />
        </Switch>
    </Container>
);

export default Subtraction;
