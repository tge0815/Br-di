# Br-di — statischer Webserver via nginx (schlank, ~25 MB)
FROM nginx:1.27-alpine

# Nur die Spieldateien in das Web-Root kopieren
COPY index.html /usr/share/nginx/html/
COPY css/       /usr/share/nginx/html/css/
COPY js/        /usr/share/nginx/html/js/

# Eigene, kleine nginx-Konfiguration (korrekte MIME-Typen + Caching)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck: Server antwortet auf /
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
