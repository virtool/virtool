/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Row, Col, ListGroup, ListGroupItem } from "react-bootstrap";

import { getCUDA } from "../../jobs/actions";
import { byteSize } from "../../utils";
import { Flex, FlexItem, Icon } from "../../base";

class CUDAList extends React.Component {

    static propTypes = {
        cuda: PropTypes.arrayOf(PropTypes.object),
        onGet: PropTypes.func
    };

    componentDidMount () {
        this.props.onGet();
    }

    render () {
        if (this.props.cuda === null) {
            return <div />;
        }

        let listComponents = this.props.cuda.map(device =>
            <ListGroupItem key={device.index}>
                <Row>
                    <Col md={4}>
                        <Flex alignItems="center">
                            <Icon name="vga" style={{fontSize: "21px"}} />
                            <FlexItem pad={5}>
                                {device.model}
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        {device.clock} MHz
                    </Col>
                    <Col md={5}>
                        {byteSize(device.total_memory)} VRAM @ {device.memory_clock} MHz
                    </Col>
                </Row>
            </ListGroupItem>
        );

        if (!listComponents.length) {
            return (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No CUDA Devices Detected
                </ListGroupItem>
            );
        }

        return (
            <div>
                <h4>
                    <strong>CUDA Devices</strong>
                </h4>
                <ListGroup>
                    {listComponents}
                </ListGroup>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        cuda: state.jobs.cuda
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getCUDA())
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(CUDAList);

export default Container;
