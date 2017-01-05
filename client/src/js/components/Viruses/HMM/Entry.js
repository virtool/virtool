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

import React from "react";
import { keys } from "lodash";
import { Label } from "react-bootstrap";

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
export default class HMMEntry extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string,
        label: React.PropTypes.string,
        cluster: React.PropTypes.number,
        families: React.PropTypes.object
    };

    showDetail = () => {
        dispatcher.router.setExtra(["detail", this.props._id]);
    };

    render () {

        const families = keys(this.props.families);

        const labelComponents = families.slice(0, 3).map((family, index) => (
            <span key={index}><Label>{family}</Label> </span>
        ));

        return (
            <tr className="pointer" onClick={this.showDetail}>
                <td>{this.props.cluster}</td>
                <td>{this.props.label}</td>
                <td>{labelComponents} {families.length > 3 ? "...": null}</td>
            </tr>
        );
    }
}
