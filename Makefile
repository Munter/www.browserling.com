DEPS:=$(shell find http-pub/ -type f -name "*.*")
PATH:=./node_modules/.bin/:${PATH}

http-pub-production: http-pub/index.html $(DEPS)
	buildProduction \
		--root http-pub \
		--outroot $@ \
		$<
	cp -r -t $@ $(dir $<)*.json $(dir $<)account
	echo 'ExpiresActive On' > $@/static/.htaccess
	echo 'ExpiresDefault "access plus 1 year"' >>  $@/static/.htaccess
	echo 'FileETag none' >>  $@/static/.htaccess
	echo 'Header append Cache-Control "public"' >>  $@/static/.htaccess

PHONY: clean deploy

deploy: http-pub-production
	scp -r http-pub-production/* munter@mntr.dk:mntr.dk/browserling/

clean:
	rm -rf http-pub-production
