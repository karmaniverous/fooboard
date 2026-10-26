/**
 * *Remember on this device* (spec.md §2.3, §3.4): whether a secret is kept
 * in local storage or only until the tab closes. The same control on a
 * new secret's fields and on a credential whose secret is entered, where
 * unticking it keeps the secret for this tab only.
 *
 * @module
 */
import { CheckField } from '@/components/CheckField';

export function RememberCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <CheckField
      label="Remember on this device (otherwise kept only until this tab closes)"
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="gap-2 text-sm"
    />
  );
}
