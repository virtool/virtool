export const mapSettingsStateToProps = state => ({
    loading: state.settings.data === null
});
