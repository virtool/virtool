import { Link } from "react-router-dom";
import PropTypes from "prop-types";

import styled from "styled-components";
import { ListGroupItem } from "react-bootstrap";
import { Badge } from "../../base";

const StyledIndexOTU = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

export const IndexOTU = ({ refId, changeCount, id, name }) => (
    <StyledIndexOTU>
        <Link to={`/refs/${refId}/otus/${id}`}>{name}</Link>
        <Badge>
            {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
        </Badge>
    </StyledIndexOTU>
);

IndexOTU.propTypes = {
    refId: PropTypes.string.isRequired,
    changeCount: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
};

export default IndexOTU;
