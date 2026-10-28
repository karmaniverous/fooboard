/**
 * Sharing and exporting saved dashboards (spec.md §3.8): choose one, some
 * or all; optionally include their credentials (off by default), which
 * are encrypted under a passphrase unless the user unticks it; then copy
 * a share link (over 32,000 characters it falls back to a file), download
 * a file, or post the link on X. The post's link never carries
 * credentials, says it reveals repo and branch names, and is offered only
 * within X's link length.
 *
 * @module
 */
import { Copy, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CheckField } from '@/components/CheckField';
import { SecretInput } from '@/components/SecretInput';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { copyText } from '@/lib/clipboard';
import { download } from '@/lib/download';
import { describeError } from '@/lib/errors';
import { useStores } from '@/storage/storesContext';

import { buildEnvelope, type ShareEnvelope } from '../envelope';
import {
  type CredentialsChoice,
  makeShare,
  secretsOf,
  shareFileName,
} from '../exportShare';
import { SHARE_LINK_MAX_CHARS, shareLink, X_LINK_MAX_CHARS } from '../link';
import { DashboardChecklist } from './DashboardChecklist';
import { PostOnX } from './PostOnX';
import { postNote, tooLongForLink } from './shareWords';

export function BoardShare({
  dashboards,
}: {
  dashboards: readonly Dashboard[];
}): React.JSX.Element {
  const { credentials } = useStores();
  const secretOf = (id: string) => credentials.get(id);
  const [selected, setSelected] = useState(
    () => new Set(dashboards.map((d) => d.id)),
  );
  const [include, setInclude] = useState(false);
  const [encrypt, setEncrypt] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const chosen = useMemo(
    () => dashboards.filter((d) => selected.has(d.id)),
    [dashboards, selected],
  );
  // Never with credentials: a post is public.
  const postLink = useMemo(
    () => (chosen.length > 0 ? shareLink(buildEnvelope(chosen, null)) : null),
    [chosen],
  );
  const referenced = chosen.flatMap((d) => d.credentials).length;
  const held = Object.keys(secretsOf(chosen, secretOf)).length;
  const needsPassphrase = include && encrypt && passphrase === '';
  const ready = chosen.length > 0 && !needsPassphrase && !busy;
  const choice: CredentialsChoice = include
    ? { include: true, passphrase: encrypt ? passphrase : null }
    : { include: false };

  const build = (use: (share: ShareEnvelope) => void) => {
    setBusy(true);
    setSaid(null);
    makeShare(chosen, choice, secretOf)
      .then(use, (err: unknown) => {
        setSaid(`Couldn't build the share: ${describeError(err)}`);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <section aria-labelledby="share-boards" className="flex flex-col gap-3">
      <h3 id="share-boards" className="text-sm font-semibold">
        Your dashboards
      </h3>
      <DashboardChecklist
        label="Dashboards to share"
        dashboards={dashboards}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <CheckField
          label="Include credentials"
          checked={include}
          onCheckedChange={setInclude}
          className="text-sm"
        />
        {include && (
          <>
            <p className="text-xs text-status-failure">
              Anyone holding this link or file can use the credentials it
              includes.
              {held < referenced &&
                ` Only ${String(held)} of ${String(referenced)} have a secret on this device.`}
            </p>
            <CheckField
              label="Encrypt them with a passphrase"
              checked={encrypt}
              onCheckedChange={setEncrypt}
              className="text-sm"
            />
            {encrypt && (
              <>
                <SecretInput
                  aria-label="Passphrase"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {passphrase === ''
                    ? 'Enter a passphrase to copy or download, or untick encryption.'
                    : 'Send the passphrase separately, never beside the link or file.'}
                </p>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!ready}
          onClick={() => {
            build((share) => {
              const link = shareLink(share);
              if (link.length > SHARE_LINK_MAX_CHARS) {
                setSaid(tooLongForLink(link.length));
                return;
              }
              copyText(link, (ok) => {
                setSaid(
                  ok
                    ? 'Link copied.'
                    : "Couldn't copy the link. Download a file instead.",
                );
              });
            });
          }}
        >
          <Copy aria-hidden className="size-4" />
          Copy board link
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!ready}
          onClick={() => {
            build((share) => {
              download(JSON.stringify(share, null, 2), shareFileName(chosen));
              setSaid('File saved.');
            });
          }}
        >
          <Download aria-hidden className="size-4" />
          Download file
        </Button>
        {postLink && postLink.length <= X_LINK_MAX_CHARS && (
          <PostOnX url={postLink}>Post this board on X</PostOnX>
        )}
      </div>
      {postLink && (
        <p className="text-xs text-muted-foreground">
          {postNote(postLink.length)}
        </p>
      )}
      <p role="status" className="min-h-5 text-xs text-muted-foreground">
        {busy ? 'Preparing…' : said}
      </p>
    </section>
  );
}
