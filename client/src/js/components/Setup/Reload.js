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
import { Icon, Button } from "virtool/js/components/Base";

export default class SetupReload extends React.Component {

    propTypes = {
        saveAndReload: React.PropTypes.func
    };

    componentDidMount () {
        this.buttonNode.focus();
    }

    render () {

        return (
            <div>
                <Alert bsStyle="info">
                    Virtool is configured and must be reloaded before it can be used.
                </Alert>

                <Button
                    ref={this.buttonNode}
                    bsStyle="primary"
                    onClick={() => this.props.saveAndReload()}
                    className="pull-right">
                    <Icon name="reset" /> Accept
                </Button>
            </div>
        );
    }
}
