/**
 * The icons of the board's actions (spec 0.2.0 §3.A): one place, so each
 * icon button and the first run's note that names it inline (*First-run
 * note icons*) show the same icon. Their names are in `actionLabels.ts`.
 *
 * @module
 */
import {
  KeyRound,
  MessageSquareText,
  Pencil,
  TriangleAlert,
  Unlink,
} from 'lucide-react';

/** The Problems button's icon, while the panel shows a problem. */
export const PROBLEMS_ICON = TriangleAlert;

/** The same button's icon while the panel shows only notes. */
export const NOTES_ICON = MessageSquareText;

/** The Unmapped runs button's icon. */
export const UNMAPPED_RUNS_ICON = Unlink;

/** The Edit dashboard button's icon. */
export const EDIT_DASHBOARD_ICON = Pencil;

/** The Credentials button's icon. */
export const CREDENTIALS_ICON = KeyRound;
