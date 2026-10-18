/**
 * A field for a pasted secret (token, secret key): hidden by default, with
 * an eye button inside the field to show or hide what was entered.
 *
 * @module
 */
import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, useState } from 'react';

import { Input } from '@/components/ui/input';
import { WithTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function SecretInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>): React.JSX.Element {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        className={cn('pr-9', className)}
      />
      <WithTooltip label={shown ? 'Hide' : 'Show'}>
        <button
          type="button"
          aria-label={shown ? 'Hide' : 'Show'}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => {
            setShown((s) => !s);
          }}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </WithTooltip>
    </div>
  );
}
