/**
 * Check whether the passed object has a given property.
 *
 * @param obj the object to inspect
 * @param property the property name to look for
 */
export function objectHasProperty(obj: object, property: string): boolean {
	return Object.hasOwn(obj, property);
}
