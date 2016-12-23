/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMEntry
 *
 */

'use strict';

import React from "react";
var Label = require('react-bootstrap/lib/Label');

var Flex = require('virtool/js/components/Base/Flex');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var HMMEntry = React.createClass({

    showDetail: function () {
        dispatcher.router.setExtra(["detail", this.props._id]);
    },

    render: function () {

        var families = Object.keys(this.props.families);

        var ellipse = families.length > 3 ? "...": null;

        var labelComponents = families.slice(0, 3).map(function (family, index) {
            return <span key={index}><Label>{family}</Label> </span>
        });

        return (
            <tr className="pointer" onClick={this.showDetail}>
                <td>{this.props.cluster}</td>
                <td>{this.props.label}</td>
                <td>{labelComponents} {ellipse}</td>
            </tr>
        );
    }
});

module.exports = HMMEntry;