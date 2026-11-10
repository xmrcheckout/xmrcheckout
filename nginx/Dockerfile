FROM nginx:1.30-alpine

RUN apk add --no-cache openssl

# nginx is built with --user=nginx, so the stock "user" directive only adds a
# warning when the container runs unprivileged.
RUN sed -i '/^user /d' /etc/nginx/nginx.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
