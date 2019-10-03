import { keys, map, reject } from "lodash-es";
import styled from "styled-components";

import { Label, ListGroupItem } from "../../base";

const StyledChange = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

const NameTag = styled.div`
    display: flex;
    justify-content: space-between;
    width: 83%;

    @media (max-width: 1080px) {
        flex-flow: row wrap;
        flex-direction: column;
        width: 95%;
    }
`;

const Name = styled.div`
    display: flex;
    @media (max-width: 1080px) {
        justify-content: flex-start;
    }
`;

const Tag = styled.div`
    display: flex;
    @media (max-width: 1080px) {
        justify-content: flex-start;
    }
`;

export default function HMMItem({ cluster, families, id, names }) {
    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = map(filteredFamilies.slice(0, 3), (family, i) => (
        <Label key={i} spaced>
            {family}
        </Label>
    ));

    return (
        <LinkContainer to={`/hmm/${id}`}>
            <StyledChange>
                <span>
                    <strong>{cluster}</strong>
                </span>
                <NameTag>
                    <Name>{names[0]}</Name>
                    <Tag>
                        {labelComponents} {filteredFamilies.length > 3 ? "..." : null}
                    </Tag>
                </NameTag>
            </StyledChange>
        </LinkContainer>
    );
}

HMMItem.propTypes = {
    cluster: PropTypes.number,
    families: PropTypes.object,
    id: PropTypes.string,
    names: PropTypes.array
};
