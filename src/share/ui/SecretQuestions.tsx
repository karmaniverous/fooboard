/**
 * The import dialog's questions about secrets (spec.md §3.8, Decision
 * 70): one labelled radio group per credential whose secret in the share
 * differs from this device's, named by its kind and label, with *Keep
 * yours* and *Use the share's* and nothing chosen. Neither secret's value
 * is shown. When *Import* stops to ask (encrypted credentials, compared
 * once the passphrase opens them), focus moves to the first question, so
 * a screen reader announces it and Tab continues from it.
 *
 * @module
 */
import { useEffect, useId, useRef } from 'react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { KIND_LABEL } from '@/credentials/kindLabel';

import type { SecretQuestion } from '../secretQuestions';
import { SECRET_ANSWERS, SECRET_QUESTION, SECRETS_DIFFER } from './shareWords';
import type { ImportForm } from './useImportForm';

function Question({
  question,
  form,
  first,
}: {
  question: SecretQuestion;
  form: ImportForm;
  first: React.RefObject<HTMLButtonElement | null> | undefined;
}): React.JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={`${id}-q`} className="text-sm">
        {KIND_LABEL[question.kind]} <em>{question.label}</em>: {SECRET_QUESTION}
      </p>
      <RadioGroup
        aria-labelledby={`${id}-q`}
        value={form.answerOf(question.id) ?? null}
        onValueChange={(value) => {
          const picked = SECRET_ANSWERS.find((a) => a.value === value);
          if (picked) form.setAnswer(question.id, picked.value);
        }}
        className="flex flex-wrap gap-x-4 gap-y-1.5"
      >
        {SECRET_ANSWERS.map((a, i) => (
          <span key={a.value} className="flex items-center gap-1.5">
            <RadioGroupItem
              ref={i === 0 ? first : undefined}
              id={`${id}-${a.value}`}
              value={a.value}
            />
            <Label htmlFor={`${id}-${a.value}`} className="text-sm">
              {a.label}
            </Label>
          </span>
        ))}
      </RadioGroup>
    </div>
  );
}

export function SecretQuestions({
  form,
}: {
  form: ImportForm;
}): React.JSX.Element | null {
  const first = useRef<HTMLButtonElement>(null);
  const { asked } = form;
  useEffect(() => {
    if (asked > 0) first.current?.focus();
  }, [asked]);
  if (form.questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{SECRETS_DIFFER}</p>
      {form.questions.map((q, i) => (
        <Question
          key={q.id}
          question={q}
          form={form}
          first={i === 0 ? first : undefined}
        />
      ))}
    </div>
  );
}
