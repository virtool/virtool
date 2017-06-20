/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { groupBy, keys, transform } from "lodash";
import { connect } from "react-redux";
import { Badge, ListGroup, ListGroupItem, PanelGroup, Panel, Table } from "react-bootstrap";

import { getIndex } from "../actions";
import { formatChangeDescription } from "../../viruses/components/Detail/History";
import { Flex, FlexItem, RelativeTime } from "virtool/js/components/Base";

class IndexDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        onGet: PropTypes.func
    };

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const detail = this.props.detail;

        const grouped = groupBy(detail.changes, "virus_name");

        const historyComponents = transform(grouped, (result, changes, virusName) => {
            const changeComponents = changes.map(change =>
                <ListGroupItem key={change.change_id}>
                    {formatChangeDescription(change)}
                </ListGroupItem>
            );

            const header = (
                <div>
                    <span className="pointer">{virusName}</span>
                    <Badge className="pull-right">{changeComponents.length}</Badge>
                </div>
            );

            result.push(
                <Panel key={virusName} eventKey={virusName} header={header}>
                    <ListGroup fill>
                        {changeComponents}
                    </ListGroup>
                </Panel>
            );
        }, []);
        
        return (
            <div>
                <h3 className="view-header">
                    <strong>Virus Index {this.props.detail.index_version}</strong>
                </h3>

                <Table bordered>
                    <tbody>
                        <tr>
                            <th>Summary</th>
                            <td>{detail.changes.length} changes in {keys(grouped).length} viruses</td>
                        </tr>
                        <tr>
                            <th>Virus Count</th>
                            <td>{detail.virus_count}</td>
                        </tr>
                        <tr>
                            <th>Created</th>
                            <td><RelativeTime time={detail.timestamp} /></td>
                        </tr>
                        <tr>
                            <th>Created By</th>
                            <td>{detail.user_id}</td>
                        </tr>
                        <tr>
                            <th>Unique ID</th>
                            <td className="text-uppercase">{detail.index_id}</td>
                        </tr>
                    </tbody>
                </Table>

                <h4 className="section-header">
                    Changes <Badge>{detail.changes.length}</Badge>
                </h4>

                <PanelGroup accordion>
                    {historyComponents}
                </PanelGroup>
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (indexVersion) => {
            console.log(indexVersion);
            dispatch(getIndex(indexVersion));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexDetail);

export default Container;
