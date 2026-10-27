/**
 * Creating a dashboard (spec.md §3.9, C-22): step 1 (the token) at
 * `/new`; once the dashboard is saved, its repos and stages steps at
 * `/new/<id>/<step>`, reading with its token through the app's query
 * environment, each change saved at once. The board, step 4, is the
 * dashboard's own page (`FirstRunNote`). Each step keeps the dashboard it
 * opened with, and moves focus to its heading as it opens (`StepFrame`).
 *
 * @module
 */
import { useParams } from 'react-router-dom';

import type { Dashboard } from '@/domain/config/dashboard';
import { DashboardNotFound } from '@/pages/DashboardNotFound';
import { useAppQueryEnv } from '@/pages/useAppQueryEnv';
import { QueryProvider } from '@/query/QueryProvider';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

import { FirstRunStepSchema } from './paths';
import { ReposStep } from './ReposStep';
import { StagesStep } from './StagesStep';
import { TokenStep } from './TokenStep';

function SavedStep({ id, step }: { id: string; step: string | undefined }) {
  const stores = useStores();
  const env = useAppQueryEnv();
  const dashboard = dashboardsOf(stores.config.load()).find((d) => d.id === id);
  const which = FirstRunStepSchema.safeParse(step);
  if (!dashboard || !which.success) return <DashboardNotFound />;
  const save = (next: Dashboard) => {
    stores.config.saveDashboard(next);
  };
  const Step = which.data === 'repos' ? ReposStep : StagesStep;
  return (
    <QueryProvider env={env}>
      <Step key={`${id}/${which.data}`} dashboard={dashboard} onSave={save} />
    </QueryProvider>
  );
}

export function FirstRunPage(): React.JSX.Element {
  const { id, step } = useParams();
  return id ? <SavedStep id={id} step={step} /> : <TokenStep />;
}
