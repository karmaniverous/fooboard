/**
 * Collapsible: Radix's collapsible primitive, re-exported in the `ui`
 * set (a trigger that shows and hides its content).
 *
 * @module
 */
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
const CollapsibleContent = CollapsiblePrimitive.Content;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
