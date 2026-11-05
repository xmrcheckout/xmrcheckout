import Link from "next/link";

import { getI18n } from "../lib/i18n/server";

const repository = "https://github.com/xmrcheckout/xmrcheckout";
// Baked in at image build time from SOURCE_COMMIT (see docker-compose.yml).
// Images built without it show no commit in the footer.
const sourceCommit = process.env.NEXT_PUBLIC_SOURCE_COMMIT ?? "";

export default async function SourceLinks() {
  const { t } = await getI18n();
  const commit = /^[0-9a-f]{40}$/.test(sourceCommit) ? sourceCommit : null;

  return (
    <p>
      <Link className="underline underline-offset-4" href={repository}>
        GitHub
      </Link>
      {commit ? (
        <>
          {" · "}
          <Link
            className="underline underline-offset-4"
            href={`${repository}/commit/${commit}`}
          >
            {t("footer.sourceCommit", { commit: commit.slice(0, 7) })}
          </Link>
        </>
      ) : null}
    </p>
  );
}
