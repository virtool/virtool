import React from "react";
import numbro from "numbro";
import { map, get } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Col, Row, Table } from "react-bootstrap";

import { getSubtraction } from "../actions";
import { Button, Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound, ViewHeader, NotFound } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import EditSubtraction from "./Edit";
import RemoveSubtraction from "./Remove";

const calculateGC = nucleotides => numbro(1 - nucleotides.a - nucleotides.t - nucleotides.n).format("0.000");

export class SubtractionDetail extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showEdit: false
        };
    }

    componentDidMount() {
        this.props.onGet(this.props.match.params.subtractionId);
    }

    handleExit = () => {
        this.setState({ showEdit: false });
    };

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const data = this.props.detail;

        if (data.ready) {
            let linkedSamples;
            let removeIcon;

            if (data.linked_samples.length) {
                const linkedSampleComponents = map(data.linked_samples, sample => (
                    <Col key={sample.id} className="linked-sample-button" xs={6} sm={4} md={3} lg={2}>
                        <LinkContainer to={`/samples/${sample.id}`}>
                            <Button block>{sample.name}</Button>
                        </LinkContainer>
                    </Col>
                ));

                linkedSamples = <Row>{linkedSampleComponents}</Row>;

                removeIcon = <div />;
            } else {
                linkedSamples = <NoneFound noun="linked samples" />;

                removeIcon = (
                    <Icon
                        name="trash"
                        bsStyle="danger"
                        onClick={this.props.onShowRemove}
                        style={{ paddingLeft: "5px" }}
                        pullRight
                    />
                );
            }

            const editIcon = (
                <Icon name="pencil-alt" bsStyle="warning" onClick={() => this.setState({ showEdit: true })} pullRight />
            );

            return (
                <div>
                    <ViewHeader title={`${data.id} - Subtraction`}>
                        <Flex alignItems="flex-end">
                            <FlexItem grow={0} shrink={0}>
                                <strong>{data.id}</strong>
                            </FlexItem>
                            <FlexItem grow={1} shrink={0}>
                                {this.props.canModify ? (
                                    <React.Fragment>
                                        <small>{removeIcon}</small>
                                        <small>{editIcon}</small>
                                    </React.Fragment>
                                ) : null}
                            </FlexItem>
                        </Flex>
                    </ViewHeader>

                    <Table bordered>
                        <tbody>
                            <tr>
                                <th>Nickname</th>
                                <td>{this.props.detail.nickname}</td>
                            </tr>

                            <tr>
                                <th>File</th>
                                <td>{data.file.id}</td>
                            </tr>

                            <tr>
                                <th>GC Estimate</th>
                                <td>{calculateGC(data.gc)}</td>
                            </tr>
                        </tbody>
                    </Table>

                    <h4 className="section-header">
                        <strong>Linked Samples</strong> <Badge>{data.linked_samples.length}</Badge>
                    </h4>

                    {linkedSamples}

                    <EditSubtraction show={this.state.showEdit} entry={this.props.detail} exited={this.handleExit} />
                    <RemoveSubtraction id={data.id} />
                </div>
            );
        }

        return <LoadingPlaceholder message="Subtraction is still being imported" />;
    }
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_SUBTRACTION_ERROR", null),
    canModify: checkAdminOrPermission(state, "modify_subtraction"),
    detail: state.subtraction.detail
});

const mapDispatchToProps = dispatch => ({
    onGet: subtractionId => {
        dispatch(getSubtraction(subtractionId));
    },

    onShowRemove: () => {
        dispatch(push({ state: { removeSubtraction: true } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SubtractionDetail);
