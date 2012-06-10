DEPS:=$(shell find http-pub/ -type f -name "*.*" | grep -v index.html)
PATH:=./node_modules/.bin/:${PATH}

production: http-pub-production/index.html

development: http-pub/index.html

PHONY: clean deploy

http-pub-production/index.html: http-pub/index.html.template $(DEPS)
	cp $< http-pub/index.html
	buildProduction \
		--root http-pub \
		--outroot $(@D) \
		http-pub/index.html
	cp -r -t $(@D) $(dir $<)account
	echo 'ExpiresActive On' > $(@D)/static/.htaccess
	echo 'ExpiresDefault "access plus 1 year"' >>  $(@D)/static/.htaccess
	echo 'FileETag none' >>  $(@D)/static/.htaccess
	echo 'Header append Cache-Control "public"' >>  $(@D)/static/.htaccess

http-pub/index.html: http-pub/index.html.template $(DEPS)
	buildDevelopment \
		--root http-pub \
		--version `git describe --long --tags --always --dirty 2>/dev/null || echo unknown` \
		$<

deploy: clean production
	scp -r http-pub-production/* munter@mntr.dk:mntr.dk/browserling/

clean:
	rm -rf http-pub/index.html
	rm -rf http-pub-production
