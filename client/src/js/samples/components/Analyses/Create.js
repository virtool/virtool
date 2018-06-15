import React from "react";
import PropTypes from "prop-types";
import { map } from "lodash-es";
import { Modal, ListGroup, Col, Label } from "react-bootstrap";
import { AlgorithmSelect, Button, ListGroupItem, NoneFound, Checkbox } from "../../../base";

const IndexSelect = ({ indexes, onSelect, selected }) => (
    <div>
        <label className="control-label">References</label>
        {indexes.length
            ? (
                <ListGroup style={{maxHeight: "84px", overflowY: "auto"}}>
                    {map(indexes, index =>
                        <ListGroupItem
                            key={index.id}
                            onClick={() => onSelect(index.id)}
                            active={selected === index.id}
                        >
                            <Col xs={1}>
                                <Checkbox checked={selected === index.id} />
                            </Col>
                            <Col xs={8}>
                                <strong>{index.reference.name}</strong>
                            </Col>
                            <Col xs={3}>
                                Index Version <Label>{index.version}</Label>
                            </Col>
                        </ListGroupItem>
                    )}
                </ListGroup>
            ) : <NoneFound noun="source references" />
        }
    </div>
);

const getInitialState = () => ({
    algorithm: "pathoscope_bowtie"
});

export default class CreateAnalysis extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        id: PropTypes.string,
        onSubmit: PropTypes.func,
        onHide: PropTypes.func,
        hasHmm: PropTypes.bool,
        refIndexes: PropTypes.array
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onSubmit(this.props.id, this.state.algorithm);
        this.props.onHide();
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onExited={() => this.setState(getInitialState())}>
            <Modal.Header>
                New Analysis
            </Modal.Header>
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <AlgorithmSelect
                        value={this.state.algorithm}
                        onChange={(e) => this.setState({algorithm: e.target.value})}
                        hasHmm={this.props.hasHmm}
                    />
                    <IndexSelect
                        indexes={this.props.refIndexes}
                        onSelect={this.handleSelect}
                        selected={this.state.index}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type="submit"
                        bsStyle="primary"
                        icon="play"
                    >
                        Start
                    </Button>
                </Modal.Footer>
            </form>
        </Modal>
    );
}
