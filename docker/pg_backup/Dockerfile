FROM postgres:16-alpine

RUN apk add --no-cache bash

COPY backup.sh /usr/local/bin/backup.sh
COPY pg_backup.cron /etc/cron.d/pg_backup

RUN chmod +x /usr/local/bin/backup.sh \
  && chmod 0644 /etc/cron.d/pg_backup \
  && crontab /etc/cron.d/pg_backup

CMD ["crond", "-f", "-l", "8"]
