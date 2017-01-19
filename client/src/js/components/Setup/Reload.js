/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupReload
 */

import React from "react";
import { Alert } from "react-bootstrap";
import { Button } from "virtool/js/components/Base";

const SetupReload = (props) => (
    <div>
        <Alert bsStyle="info">
            Virtool is configured and must be reloaded before it can be used.
        </Alert>

        <Button
            bsStyle="primary"
            icon="reset"
            onClick={() => props.saveAndReload()}
            pullRight
        >
            Accept
        </Button>
    </div>
);

SetupReload.propTypes = {
    saveAndReload: React.PropTypes.func
};

export default SetupReload;
