import React from "react";
import PropTypes from "prop-types";
import { map, find, reject } from "lodash-es";
import { Modal, ListGroup, Col, Label } from "react-bootstrap";
import { AlgorithmSelect, Button, ListGroupItem, NoneFound, Checkbox } from "../../../base";
import { getTaskDisplayName } from "../../../utils";

const IndexSelect = ({ indexes, onSelect, selected }) => (
    <div>
        <label className="control-label">References</label>
        {indexes.length
            ? (
                <ListGroup style={{maxHeight: "165px", overflowY: "auto"}}>
                    {map(indexes, index =>
                        <ListGroupItem
                            key={index.id}
                            onClick={() => onSelect({ id: index.id, refId: index.reference.id })}
                        >
                            <Col xs={1}>
                                <Checkbox checked={!!find(selected, ["id", index.id])} />
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
    algorithm: "pathoscope_bowtie",
    selected: []
});

export default class CreateAnalysis extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        samples: PropTypes.array,
        id: PropTypes.string,
        onSubmit: PropTypes.func,
        onHide: PropTypes.func,
        hasHmm: PropTypes.bool,
        refIndexes: PropTypes.array,
        selected: PropTypes.array
    };

    handleSelect = (newEntry) => {
        let newSelected = this.state.selected.slice();

        if (find(this.state.selected, ["id", newEntry.id])) {
            newSelected = reject(newSelected, ["id", newEntry.id]);
        } else {
            newSelected = [...newSelected, {...newEntry}];
        }

        this.setState({selected: newSelected});
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onSubmit(this.props.id, this.state.selected, this.state.algorithm);
        this.props.onHide();
    };

    render () {

        const jobMessage = this.props.samples
            ? `Start ${this.state.selected.length} ${getTaskDisplayName(this.state.algorithm)} job(s)
             each on ${this.props.samples.length} sample(s).`
            : `Start ${this.state.selected.length} ${getTaskDisplayName(this.state.algorithm)} job(s).`;
        const jobSummary = this.state.selected.length ?
            (
                <div style={{float: "left"}}>
                    {jobMessage}
                </div>
            ) : null;

        return (
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
                            selected={this.state.selected}
                        />
                    </Modal.Body>
                    <Modal.Footer>
                        {jobSummary}
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
}
