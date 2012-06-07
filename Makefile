DEPS:=$(shell find http-pub/ -type f -name "*.*")
PATH:=./node_modules/.bin/:${PATH}

http-pub-production: http-pub/index.html $(DEPS)
	buildProduction \
		--root http-pub \
		--outroot $@ \
		$<
	echo 'ExpiresActive On' > $@/static/.htaccess
	echo 'ExpiresDefault "access plus 1 year"' >>  $@/static/.htaccess
	echo 'FileETag none' >>  $@/static/.htaccess
	echo 'Header append Cache-Control "public"' >>  $@/static/.htaccess

PHONY: clean

clean:
	rm -rf http-pub-production
