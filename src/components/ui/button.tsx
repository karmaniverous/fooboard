/**
 * Button: shadcn-style button, adapted from the jeeves-server client
 * (`packages/service/client/src/components/ui/button.tsx`); its classes come
 * from the shared `buttonVariants` recipe.
 *
 * @module
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import {
  type ButtonSize,
  type ButtonVariant,
  buttonVariants,
} from './buttonVariants';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={buttonVariants({ variant, size, className })}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button };
