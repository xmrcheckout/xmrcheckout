FROM alpine:3.20

RUN addgroup -S -g 70 postgres \
  && adduser -S -D -H -u 70 -G postgres postgres \
  && apk add --no-cache bash postgresql16-client

COPY backup.sh /usr/local/bin/backup.sh
COPY run-backup-loop.sh /usr/local/bin/run-backup-loop.sh

RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/run-backup-loop.sh

USER postgres

CMD ["/usr/local/bin/run-backup-loop.sh"]
