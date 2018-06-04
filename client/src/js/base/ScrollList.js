import React from "react";
import { map } from "lodash-es";
import { LoadingPlaceholder } from "./index";

export class ScrollList extends React.Component {

    componentDidMount () {
        window.addEventListener("scroll", this.onScroll, false);
    }

    componentWillUnMount () {
        window.removeEventListener("scroll", this.onScroll, false);
    }

    onScroll = () => {
        if (this.props.list.length
            && this.props.hasNextPage
            && !this.props.isNextPageLoading
            && (document.body.offsetHeight - 500) <= (window.innerHeight + window.scrollY)
        ) {
            this.props.loadNextPage(this.props.page + 1);
        }
    };

    render () {

        const { list, rowRenderer, isNextPageLoading } = this.props;

        return (
            <div>
                {map(list, (item, index) => rowRenderer(index))}
                {isNextPageLoading ? <LoadingPlaceholder margin="20px" /> : null}
            </div>
        );
    }
}
