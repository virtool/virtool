import React from "react";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import {
  toNumber,
  upperFirst,
  forEach,
  endsWith,
  isEmpty,
  get
} from "lodash-es";
import AdministrationSection from "../Section";
import {
  Alert,
  Flex,
  FlexItem,
  InputError,
  LoadingPlaceholder
} from "../../../base";
import { getResources } from "../../../jobs/actions";
import {
  maxResourcesSelector,
  minResourcesSelector,
  checkTaskUpperLimits
} from "../../selectors";
import { updateSetting } from "../../actions";
import { clearError } from "../../../errors/actions";
import { getTargetChange } from "../../../utils";

export const getErrorMessage = (isError, min, max) =>
  isError ? `Value must be between ${min} and ${max}` : null;

export const LimitLabel = ({ label, available, unit }) => (
  <h5>
    <Flex alignItems="center">
      <FlexItem grow={1} shrink={0}>
        <strong>{label}</strong>
      </FlexItem>
      <FlexItem grow={0} shrink={0}>
        <small className="text-info">
          {available} {unit} available
        </small>
      </FlexItem>
    </Flex>
  </h5>
);

export class Resources extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      mem: this.props.mem,
      proc: this.props.proc,
      errorProc: false,
      errorMem: false,
      showAlert: false
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.mem !== prevState.mem) {
      return { errorMem: false };
    }

    if (nextProps.proc !== prevState.proc) {
      return { errorProc: false };
    }

    return null;
  }

  componentDidMount() {
    this.props.onGet();
  }

  componentDidUpdate(prevProps, prevState) {
    // If computing resources are lower than server set defaults,
    // overwrite mem and proc values to resource values maximums
    if (!prevProps.overResourceMax && this.props.overResourceMax) {
      forEach(this.props.overResourceMax, (value, key) => {
        const type = endsWith(key, "proc") ? "Proc" : "Mem";
        this.props.onUpdate({ name: key, value: this.props[`max${type}`] });
      });
    }

    if (
      !isEmpty(prevProps.overResourceMax) &&
      isEmpty(this.props.overResourceMax)
    ) {
      if (this.props.maxMem < prevState.mem) {
        this.props.onUpdate({ name: "mem", value: this.props.maxMem });
      }
      if (this.props.maxProc < prevState.proc) {
        this.props.onUpdate({ name: "proc", value: this.props.maxProc });
      }
    }
  }

  handleChange = e => {
    this.setError(e, false);
    this.props.onClearError("UPDATE_SETTINGS_ERROR");
  };

  handleInvalid = e => {
    this.setError(e, true);
  };

  handleSave = e => {
    const { value, error } = getTargetChange(e);
    const val = toNumber(value);

    if (val <= e.max && val >= e.min) {
      this.props.onUpdate(e);
    } else {
      this.setState({ [error]: true });
    }
  };

  setError = (e, val) => {
    e.preventDefault();
    this.setState({
      [`error${upperFirst(e.target.name)}`]: val
    });
  };

  render() {
    if (this.props.resources === null) {
      return <LoadingPlaceholder />;
    }

    const errorMessageProc = getErrorMessage(
      this.state.errorProc,
      this.props.minProc,
      this.props.maxProc
    );

    const errorMessageMem = getErrorMessage(
      this.state.errorMem,
      this.props.minMem,
      this.props.maxMem
    );

    let alert;

    if (this.props.error) {
      alert = (
        <Alert bsStyle="danger" icon="exclamation-circle">
          Resource Limit values cannot be lower than corresponding Task-specific
          Limits.
        </Alert>
      );
    }

    const content = (
      <Panel.Body>
        <LimitLabel
          label="CPU Limit"
          available={this.props.maxProc}
          unit="cores"
        />
        <InputError
          type="number"
          name="proc"
          min={this.props.minProc}
          max={this.props.maxProc}
          onSave={this.handleSave}
          onInvalid={this.handleInvalid}
          onChange={this.handleChange}
          initialValue={this.props.proc}
          error={errorMessageProc}
          noMargin
          withButton
        />

        <LimitLabel
          label="Memory Limit (GB)"
          available={this.props.maxMem}
          unit="GB"
        />
        <InputError
          type="number"
          name="mem"
          min={this.props.minMem}
          max={this.props.maxMem}
          onSave={this.handleSave}
          onInvalid={this.handleInvalid}
          onChange={this.handleChange}
          initialValue={this.props.mem}
          error={errorMessageMem}
          noMargin
          withButton
        />
      </Panel.Body>
    );

    return (
      <div>
        {alert}
        <AdministrationSection
          title="Resource Limits"
          description="Set limits on the computing resources Virtool can use on the host server."
          content={content}
        />
      </div>
    );
  }
}

const mapStateToProps = state => {
  const { maxProc, maxMem } = maxResourcesSelector(state);
  const { minProc, minMem } = minResourcesSelector(state);

  const overResourceMax = checkTaskUpperLimits(state);
  const error = get(state, "errors.UPDATE_SETTINGS_ERROR.message", "");

  return {
    proc: state.settings.data.proc,
    mem: state.settings.data.mem,
    minProc,
    minMem,
    maxProc,
    maxMem,
    resources: state.jobs.resources,
    error,
    overResourceMax
  };
};

const mapDispatchToProps = dispatch => ({
  onUpdate: e => {
    dispatch(updateSetting(e.name, toNumber(e.value)));
  },

  onGet: () => {
    dispatch(getResources());
  },

  onClearError: error => {
    dispatch(clearError(error));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Resources);
