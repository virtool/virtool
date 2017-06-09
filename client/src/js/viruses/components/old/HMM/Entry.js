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

export default class HMMEntry extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string,
        label: React.PropTypes.string,
        cluster: React.PropTypes.number,
        families: React.PropTypes.object
    };

    render () {

        const families = keys(this.props.families);

        const labelComponents = families.slice(0, 3).map((family, index) => (
            <span key={index}><Label>{family}</Label> </span>
        ));

        return (
            <tr className="pointer" onClick={() => window.router.setExtra(["detail", this.props._id])}>
                <td>{this.props.cluster}</td>
                <td>{this.props.label}</td>
                <td>{labelComponents} {families.length > 3 ? "...": null}</td>
            </tr>
        );
    }
}
