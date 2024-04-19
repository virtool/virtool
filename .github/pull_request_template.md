## Changes
<!--- Describe your changes in a bulleted list --->

## Compatibility

We need to be very careful to identify breaking changes in.

Sources of breaking changes:

### API
* Removing a field from a response from an API endpoint.
* Changing the shape of a response from an API endpoint.
* Changing paths or search query parameters.
* Removing deprecated functionality.


* [ ] Any changes I have made to the API are backwards compatible.

### Migration
* Making changes that require a certain migration to have been applied.


* [ ] My changes do not require a newer migration than the currently required migration..

### Configuration
* Changing configuration options that could break configurations in 
  production and development environments.


* [ ] My changes do not change configuration value names or types.

### Services

* Making changes that require a certain version of a service like Postgres, Redis, or
  OpenFGA.


* [ ] My changes don't impose any new requirements on services.

### Notes

_If you have introduced breaking changes, explain here._

## Pre-Review Checklist
- [ ] All changes are tested.
- [ ] All touched code documentation is updated.
- [ ] Deepsource issues have been reviewed and addressed.
- [ ] Comments and `print` statements have been removed.
