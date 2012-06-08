DEPS:=$(shell find http-pub/ -type f -name "*.[js|css|png|gif|json|template]")
PATH:=./node_modules/.bin/:${PATH}

http-pub/index.html: http-pub/index.html.template $(DEPS)
	buildDevelopment \
		--root http-pub \
		--version `git describe --long --tags --always --dirty 2>/dev/null || echo unknown` \
		$<

http-pub-production: http-pub/index.html.template $(DEPS)
	cp $< http-pub/index.html
	buildProduction \
		--root http-pub \
		--outroot $@ \
		http-pub/index.html
	cp -r -t $@ $(dir $<)account
	echo 'ExpiresActive On' > $@/static/.htaccess
	echo 'ExpiresDefault "access plus 1 year"' >>  $@/static/.htaccess
	echo 'FileETag none' >>  $@/static/.htaccess
	echo 'Header append Cache-Control "public"' >>  $@/static/.htaccess

PHONY: clean deploy

deploy: http-pub-production
	scp -r http-pub-production/* munter@mntr.dk:mntr.dk/browserling/

clean:
	rm -rf http-pub/index.html
	rm -rf http-pub-production
