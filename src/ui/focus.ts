export const focusableSelector =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElements(root: ParentNode | null) {
  return [...(root?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
}
