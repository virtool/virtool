/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMFiles
 */

'use strict';

var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');
var Utils = require('virtool/js/Utils');

var makeSpecifier = function (value, noun) {
    return [(value === 1 ? "is": "are"), Utils.numberToWord(value), noun + (value === 1 ? "": "s")].join(" ")
};

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var HMMErrors = React.createClass({

    propTypes: {
        errors: React.PropTypes.object
    },

    render: function () {

        var errorComponents = [];

        _.forIn(this.props.errors, function (value, error) {

            var message;

            var alertStyle = "danger";

            var button = (
                <Button onClick={this.props.retrieveFiles}>
                    <Icon name="reset"/> Refresh
                </Button>
            );

            if (error === "hmm_dir" && value) {
                message = "The HMM directory could not be found.";
            }

            if (error === "hmm_file" && value) {
                message = (
                    <span>
                        <strong>The file <code>vFam.hmm</code> could not be found. </strong>
                        Please add it to the HMM data directory and refresh to see changes.
                    </span>
                );
            }

            if (error === "press" && value) {
                message = (
                    <span>
                        <strong>One or more pressed HMM files are missing. </strong>
                        Repairing this problem will call <code>hmmpress</code> on the existing HMM files.
                    </span>
                );

                button = (
                    <Flex.Item grow={0} shrink={0} pad={15}>
                        <Button disabled={this.props.pressing || this.props.cleaning} onClick={this.props.press}>
                            <Icon name="hammer" pending={this.props.pressing} /> Repair
                        </Button>
                    </Flex.Item>
                );
            }

            if (error === "not_in_database" && value) {
                message = (
                    <span>
                        <strong>There {makeSpecifier(value.length, "profiles")} in the HMM file that do not have annotations in the database.</strong>
                        <span> Ensure the annotation database and HMM file match. This cannot be done automatically.</span>
                    </span>
                );
            }

            if (error === "not_in_file" && value) {
                alertStyle = "warning";

                message = (
                    <span>
                        <strong>There are {makeSpecifier(value.length, "annotation")} in the database for which no profiles exist in the HMM file.</strong>
                        <span> Repairing this problem will remove extra annotations from the database.</span>
                    </span>
                );

                button = (
                    <Flex.Item grow={0} shrink={0} pad={30}>
                        <Button disabled={this.props.pressing || this.props.cleaning} onClick={this.props.clean}>
                            <Icon name="hammer" pending={this.props.cleaning} /> Repair
                        </Button>
                    </Flex.Item>
                );
            }

            if (message) {
                errorComponents.push(
                    <Alert key={error} bsStyle={alertStyle} className={error === "hmm_file" || error === "hmm_dir" ? "no-margin": null}>
                        <Flex alignItems="center">
                            <Flex.Item grow={1} shrink={1}>
                                {message}
                            </Flex.Item>

                            {button}
                        </Flex>
                    </Alert>
                );
            }
        }.bind(this));

        return (
            <div>
                {this.props.files.length > 0 ? <h5><strong>Errors</strong></h5>: null}
                {errorComponents}
            </div>
        );



    }
});

module.exports = HMMErrors;
