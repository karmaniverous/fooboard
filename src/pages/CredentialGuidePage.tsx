/**
 * Credential guide (spec.md C-3a): how to create the narrowest credentials
 * fooboard needs, what a leaked one exposes, and how to revoke each.
 * Linked from every credential field and from "needs credential" cells.
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';

const IAM_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FooboardAmplifyReadOnly",
      "Effect": "Allow",
      "Action": [
        "amplify:ListApps",
        "amplify:ListBranches",
        "amplify:ListJobs",
        "amplify:GetJob"
      ],
      "Resource": [
        "arn:aws:amplify:us-east-1:123456789012:apps/d2x8k1",
        "arn:aws:amplify:us-west-2:123456789012:apps/d7q4p0"
      ]
    }
  ]
}`;

const SECTIONS = [
  ['github', 'GitHub fine-grained personal access token'],
  ['classic', 'Classic token (not recommended)'],
  ['shared', 'Shared boards: use a dedicated token'],
  ['aws', 'AWS read-only policy (Amplify rows)'],
  ['leaks', 'What a leaked credential exposes'],
  ['revoke', 'How to revoke'],
] as const;

function Section({
  id,
  children,
}: {
  id: (typeof SECTIONS)[number][0];
  children: React.ReactNode;
}): React.JSX.Element {
  const index = SECTIONS.findIndex(([s]) => s === id);
  return (
    <section id={id} className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {index + 1}. {SECTIONS[index]?.[1]}
      </h2>
      {children}
    </section>
  );
}

export function CredentialGuidePage(): React.JSX.Element {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 text-sm leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Credential guide</h1>
        <p>
          fooboard never sees your credentials. They stay in this browser and
          are used only to call GitHub and AWS directly.
        </p>
        <ol className="list-decimal pl-6">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="underline underline-offset-2">
                {title}
              </a>
            </li>
          ))}
        </ol>
      </header>

      <Section id="github">
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>
            Go to{' '}
            <ExternalLink href="https://github.com/settings/personal-access-tokens/new">
              github.com/settings/personal-access-tokens/new
            </ExternalLink>
            .
          </li>
          <li>
            Set <strong>Resource owner</strong> to your personal account, or to
            the organization that owns the repos you want on the board. Org
            repos can only be selected when the org itself is the resource
            owner.
            <p className="mt-1 rounded-md bg-badge-behind/20 p-2">
              An organization may require an admin to approve fine-grained
              tokens. Until an admin does, the token stays pending and the board
              shows &ldquo;needs credential&rdquo;.
            </p>
          </li>
          <li>
            Under <strong>Repository access</strong>, choose{' '}
            <em>Only select repositories</em> and pick only the repos this
            dashboard needs.
          </li>
          <li>
            Under <strong>Permissions</strong>, set these repository permissions
            to <em>Read-only</em>, and leave every other permission at{' '}
            <em>No access</em>:
            <table className="mt-1 border-collapse text-left">
              <thead>
                <tr>
                  <th className="border px-2 py-1">Permission</th>
                  <th className="border px-2 py-1">Access</th>
                </tr>
              </thead>
              <tbody>
                {['Metadata', 'Contents', 'Actions'].map((p) => (
                  <tr key={p}>
                    <td className="border px-2 py-1">{p}</td>
                    <td className="border px-2 py-1">Read-only</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
          <li>
            Set a short <strong>expiration</strong> (30 to 90 days). fooboard
            warns as expiry approaches, based on what GitHub reports.
          </li>
          <li>
            Generate the token and paste it into the credential field. Tick{' '}
            <em>Remember on this device</em> if you want it kept after the
            browser closes.
          </li>
        </ol>
      </Section>

      <Section id="classic">
        <p>
          A classic token works, but only with the <code>repo</code> scope,
          which grants read <em>and write</em> access to everything its owner
          can reach, not just the repos on this board. Use a fine-grained token
          unless your organization disallows them.
        </p>
      </Section>

      <Section id="shared">
        <p>
          Everyone viewing a shared dashboard with the same token shares that
          token&apos;s hourly GitHub budget (fooboard backs off to stay under
          half of it; the board shows what&apos;s left). For a shared board:
        </p>
        <ul className="list-disc pl-6">
          <li>create a token just for this board, not your everyday one;</li>
          <li>so it can be revoked without affecting your other tools;</li>
          <li>
            and name it clearly, e.g. <code>fooboard-acme-shared-2026Q4</code>.
          </li>
        </ul>
      </Section>

      <Section id="aws">
        <p>
          Create an IAM user with this policy, restricted to the Amplify apps
          you actually use, then create an access key for it. Use one credential
          per AWS account; a row whose apps span accounts gets one source per
          account.
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {IAM_POLICY}
        </pre>
      </Section>

      <Section id="leaks">
        <ul className="list-disc pl-6">
          <li>
            <strong>Fine-grained GitHub token</strong> (as above): read access
            to the selected repos only, including their code, workflow files and
            Actions logs. It cannot write, push or start anything.
          </li>
          <li>
            <strong>Classic token</strong> (<code>repo</code> scope): read and
            write access to every repo its owner can reach. Treat a leak as a
            compromise of those repos.
          </li>
          <li>
            <strong>AWS access key</strong> (policy above): read access to app,
            branch and job details for the listed Amplify apps only, not to the
            rest of your AWS account.
          </li>
        </ul>
      </Section>

      <Section id="revoke">
        <ul className="list-disc pl-6">
          <li>
            <strong>GitHub</strong>:{' '}
            <ExternalLink href="https://github.com/settings/personal-access-tokens">
              github.com/settings/personal-access-tokens
            </ExternalLink>{' '}
            (or your organization&apos;s token admin page): find the token and
            delete it. This takes effect immediately.
          </li>
          <li>
            <strong>AWS</strong>: IAM console, Users, the dedicated user,
            Security credentials: deactivate or delete the access key. Delete
            the user if it exists only for this board.
          </li>
          <li>
            <strong>In fooboard</strong>, <em>Forget</em> removes a credential
            from this browser. It does not revoke it at GitHub or AWS; do that
            too.
          </li>
        </ul>
      </Section>
    </article>
  );
}
