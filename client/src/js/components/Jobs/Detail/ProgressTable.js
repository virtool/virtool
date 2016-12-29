/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressTable
 */

import React from "react";
import { Table, Panel } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";
import ProgressEntry from "./ProgressEntry";

/**
 * A table the shows the status update for a VT job.
 */
export default class ProgressTable extends React.PureComponent {

    static propTypes = {
        status: React.PropTypes.array
    };

    render () {

        const statusComponents = this.props.status.map((document, index) =>
            <ProgressEntry key={index} {...document} />
        );

        return (
            <div>
                <h5><strong><Icon name="cog" /> Progress Log</strong></h5>
                <Panel>
                    <Table style={{position: "relative"}} fill>
                        <thead>
                            <tr>
                                <th className="col-sm-4">Timestamp</th>
                                <th className="col-sm-3">State</th>
                                <th className="col-sm-5">Stage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statusComponents}
                        </tbody>
                    </Table>
                </Panel>
            </div>
        );
    }

}
